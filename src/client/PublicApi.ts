import { EventEmitter } from "events";
import { Readable } from "stream";
import type { Ask } from "../types/schema.types.js";
import type { TextChunkHandler } from "../types/api.types.js";
import type { AgentListResponse } from "../types/agents.types.js";

import { HttpClient } from "../http/HttpClient.js";
import { iterateTextStream, readTextStream } from "../streaming/textStream.js";

import axios from "axios";
import { withPaymentInterceptor, decodeXPaymentResponse } from "x402-axios";

/**
 * Events for both askasync and streaming
 */
export interface StreamEvents {
  message: (text: string) => void;
  status: (text: string) => void;
  meta: (data: any) => void;
  done: () => void;
  error: (err: unknown) => void;
}

/** Lightweight emitter with typed events */
export class AskAsyncEmitter extends EventEmitter {
  on<U extends keyof StreamEvents>(event: U, listener: StreamEvents[U]): this {
    return super.on(event, listener);
  }
}

/**
 * Public API client — covers agents + streaming endpoints.
 * Integrates x402 payment interceptor for 402 handling.
 */
export class PublicApiClient {
  private api: any;

  constructor(
    private readonly http: HttpClient,
    private readonly signer?: any,
    private readonly network?: string
  ) {
    const baseURL = (this as any).http["baseUrl"];
    const instance = axios.create({ baseURL, timeout: 20000 });

    this.api = signer ? withPaymentInterceptor(instance, signer) : instance;

    // Decode 402 headers if present
    this.api.interceptors.response.use(
      (response: any) => {
        const hdr =
          response.headers["x-payment-response"] ||
          response.headers["X-Payment-Response"];
        if (hdr) {
          try {
            const decoded = decodeXPaymentResponse(hdr);
            console.log("Decoded x-payment-response:", decoded);
          } catch (e: unknown) {
            if (e instanceof Error)
              console.warn("Failed to decode x-payment-response:", e.message);
          }
        }
        return response;
      },
      (error: any) => {
        if (error.response) {
          const hdr =
            error.response.headers["x-payment-response"] ||
            error.response.headers["X-Payment-Response"];
          if (hdr) {
            try {
              console.log(
                "Decoded x-payment-response (error):",
                decodeXPaymentResponse(hdr)
              );
            } catch (e: unknown) {
              if (e instanceof Error)
                console.warn(
                  "Failed to decode x-payment-response:",
                  e.message
                );
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /** GET /api/Public/agents */
  async listAgents(): Promise<AgentListResponse> {
    return this.http.get<AgentListResponse>("/api/Public/agents");
  }

  /**
   * POST /api/Public/agents/{agentId}/askasync — emits {status, message, done, error}.
   */
  askAgentAsyncStream(agentId: string, body: Ask): AskAsyncEmitter {
    if (!body.input || !body.userName)
      throw new Error("Missing required fields 'input' and 'userName' in Ask.");

    const emitter = new AskAsyncEmitter();

    (async () => {
      try {
        const res = await this.api.post(
          `/api/Public/agents/${encodeURIComponent(agentId)}/askasync`,
          { ...body, agentId },
          { responseType: "text" }
        );

        const lines = res.data
          .toString()
          .split(/\n+/)
          .map((l: string) => l.trim())
          .filter(Boolean);

        for (const line of lines) {
          try {
            const evt = JSON.parse(line.replace(/^data:\s*/, ""));
            switch (evt.ResponseType) {
              case 0:
                emitter.emit("message", evt.Value ?? "");
                break;
              case 2:
                emitter.emit("status", evt.Value ?? "");
                break;
              case 8:
                emitter.emit("done");
                return;
            }
          } catch {
            // ignore malformed lines
          }
        }

        emitter.emit("done");
      } catch (err: unknown) {
        emitter.emit("error", err instanceof Error ? err.message : String(err));
      }
    })();

    return emitter;
  }

  /**
   * POST /api/Public/askstreaming — emits {status, meta, message, done, error}.
   * Compatible with Axios (Node.js stream) + x402 payments.
   */
  askStreamingEmitter(body: Ask): EventEmitter {
    const emitter = new AskAsyncEmitter();

    (async () => {
      try {
        const res = await this.api.post("/api/Public/askstreaming", body, {
          responseType: "stream",
          headers: {
            "Content-Type": "application/json",
            ...(this as any).http["apiKey"]
              ? { "X-Api-Key": (this as any).http["apiKey"] }
              : {},
          },
        });

        const stream = res.data as Readable;
        stream.setEncoding("utf8");
        let buffer = "";

        for await (const chunk of stream) {
          buffer += chunk;
          const lines = buffer.split(/\n+/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const jsonStr = line.replace(/^data:\s*/, "").trim();
            if (!jsonStr) continue;

            try {
              const evt = JSON.parse(jsonStr);
              switch (evt.ResponseType) {
                case 0:
                  emitter.emit("message", evt.Value ?? "");
                  break;
                case 2:
                  emitter.emit("status", evt.Value ?? "");
                  break;
                case 11:
                  emitter.emit("meta", JSON.parse(evt.Value));
                  break;
                case 8:
                  emitter.emit("done");
                  break;
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }

        emitter.emit("done");
      } catch (err: unknown) {
        emitter.emit("error", err instanceof Error ? err.message : String(err));
      }
    })();

    return emitter;
  }

  /** Fallback methods for compatibility */
  async askStreamingRaw(body: Ask): Promise<any> {
    return this.api.post("/api/Public/askstreaming", body, { responseType: "text" });
  }

  async askStreaming(body: Ask, onChunk: TextChunkHandler): Promise<void> {
    const res = await this.askStreamingRaw(body);
    await readTextStream(res, onChunk);
  }

  async *askStreamingIter(body: Ask): AsyncGenerator<string, void, unknown> {
    const res = await this.askStreamingRaw(body);
    yield* iterateTextStream(res);
  }
}
