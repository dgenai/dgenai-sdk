import { wrapFetchWithPayment } from "x402-fetch";
import { Readable } from "node:stream";

/**
 * Fetch-compatible wrapper that supports x402 automatic payments.
 * Fully compatible with A2AClient.fromCardUrl(fetchImpl).
 */
export function createX402Fetch(signer: any): typeof fetch {

    let fetchCandidate = (typeof window !== "undefined"
        ? window.fetch.bind(window)
        : globalThis.fetch?.bind(globalThis));


  const fetchWithPayment = signer
    ? wrapFetchWithPayment(fetchCandidate, signer)
    : fetchCandidate;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const headers = new Headers(init?.headers as any);

    const accept = headers.get("accept") || headers.get("Accept") || "";
    const isSSE = accept.includes("text/event-stream");

    const res = await fetchWithPayment(url, init);

    // Node's native fetch returns a Web ReadableStream
    // Axios streams return NodeJS.ReadableStream
    const body: any = res.body;

    if (isSSE && body) {
      // Detect if this is a NodeJS stream (Axios)
      const isNodeStream =
        typeof body.on === "function" && typeof body.pipe === "function";

      let webStream: ReadableStream<Uint8Array>;

      if (isNodeStream) {
        // Convert NodeJS.ReadableStream → Web ReadableStream
        if (typeof (Readable as any).toWeb === "function") {
          webStream = (Readable as any).toWeb(body);
        } else {
          // Manual fallback conversion
          webStream = new ReadableStream<Uint8Array>({
            start(controller) {
              body.on("data", (chunk: Buffer | string) => {
                const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
                controller.enqueue(new Uint8Array(buf));
              });
              body.on("end", () => controller.close());
              body.on("error", (err: Error) => controller.error(err));
            },
          });
        }
      } else {
        // Already a Web ReadableStream
        webStream = body as ReadableStream<Uint8Array>;
      }

      return new Response(webStream, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }

    return res;
  };
}
