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
 * Interface describing events emitted by streaming endpoints.
 */
export interface StreamEvents {
  message: (text: string) => void;
  status: (text: string) => void;
  meta: (data: any) => void;
  done: () => void;
  error: (err: unknown) => void;
}

/**
 * Custom event emitter for agent streaming responses.
 */
export class AskAsyncEmitter extends EventEmitter {
  on<U extends keyof StreamEvents>(event: U, listener: StreamEvents[U]): this {
    return super.on(event, listener);
  }
}

/**
 * Public API client integrating x402-axios for payment handling.
 * - Displays all intercepted headers and responses (including x402 flow)
 * - Pretty-prints both headers and response bodies
 */
export class PublicApiClient {
  private api: any;
  private debug: boolean;

  constructor(
    private readonly http: HttpClient,
    private readonly signer?: any,
    private readonly network?: string,
    debugMode = false
  ) {
    this.debug = debugMode || process.env.DEBUG_X402 === "true";

    const baseAxios =
      (http as any).axiosInstance ||
      (http as any).axios ||
      axios.create({ baseURL: (http as any).baseUrl });

    this.api = signer ? withPaymentInterceptor(baseAxios, signer) : baseAxios;

    if (this.debug) {
      this.logInfo("Initializing PublicApiClient...");
      this.logInfo(`Signer: ${signer ? "attached" : "none"}`);
      this.logInfo(`Base URL: ${this.api.defaults?.baseURL}`);
    }

    // Intercept *all* responses and display headers + data
// Intercept responses (including x402 flows)
// Intercept responses (including x402 flows)
this.api.interceptors.response.use(
  (response: any) => {
    const hdr =
      response.headers["x-payment-response"] ||
      response.headers["X-Payment-Response"];
    if (hdr) {
      try {
        const decoded = JSON.parse(hdr);
        const payerShort =
          decoded.payer?.slice(0, 6) + "..." + decoded.payer?.slice(-4);
        const signature = decoded.signature || decoded.transaction || "unknown";
        const network = decoded.network || "unknown";

        console.log(
          `\x1b[32m[${this.timestamp()}] [x402]\x1b[0m payment confirmed — network: ${network}`
        );
        console.log(
          `\x1b[90m  payer:\x1b[0m ${decoded.payer}\n\x1b[90m  signature:\x1b[0m ${signature}\n`
        );
      } catch (e: any) {
        this.logWarn("Failed to parse x-payment-response:", e.message);
      }
    }
    return response;
  },
  (error: any) => {
    const hdr =
      error?.response?.headers?.["x-payment-response"] ||
      error?.response?.headers?.["X-Payment-Response"];
    if (hdr) {
      try {
        const decoded = JSON.parse(hdr);
        const payerShort =
          decoded.payer?.slice(0, 6) + "..." + decoded.payer?.slice(-4);
        const signature = decoded.signature || decoded.transaction || "unknown";
        const network = decoded.network || "unknown";

        console.log(
          `\x1b[31m[${this.timestamp()}] [x402-error]\x1b[0m payment failed — network: ${network}`
        );
        console.log(
          `\x1b[90m  payer:\x1b[0m ${decoded.payer}\n\x1b[90m  signature:\x1b[0m ${signature}\n`
        );
      } catch (e: any) {
        this.logWarn("Failed to parse x-payment-response:", e.message);
      }
    }
    return Promise.reject(error);
  }
);


  }

  /** ============================ UTILITIES ============================ **/

  private timestamp() {
    return new Date().toISOString().split("T")[1].replace("Z", "");
  }

  private logInfo(...args: any[]) {
    console.log(`\x1b[36m[${this.timestamp()}] [INFO]\x1b[0m`, ...args);
  }

  private logWarn(...args: any[]) {
    console.warn(`\x1b[33m[${this.timestamp()}] [WARN]\x1b[0m`, ...args);
  }

  private logError(...args: any[]) {
    console.error(`\x1b[31m[${this.timestamp()}] [ERROR]\x1b[0m`, ...args);
  }

  /** ============================ METHODS ============================ **/

  async listAgents(): Promise<AgentListResponse> {
    if (this.debug) this.logInfo("Fetching public agent list...");
    return this.http.get<AgentListResponse>("/api/Public/agents");
  }

  askAgentAsyncStream(agentId: string, body: Ask): AskAsyncEmitter {
    if (!body.input || !body.userName)
      throw new Error("Missing required fields: 'input' and 'userName'.");

    const emitter = new AskAsyncEmitter();

    (async () => {
      try {
        if (this.debug) this.logInfo(`→ Sending async request to agent: ${agentId}`);

        const res = await this.api.post(
          `/api/Public/agents/${encodeURIComponent(agentId)}/askasync`,
          { ...body, agentId }
        );

        if (!res?.data) {
          emitter.emit("error", "Empty or undefined API response");
          return;
        }

        const raw = res.data.toString().trim();
        const lines = raw.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);

        for (const line of lines) {
          try {
            const evt = JSON.parse(line.replace(/^data:\s*/, ""));
            switch (evt.ResponseType) {
              case 0:

                if (typeof process !== "undefined" && process.stdout) {
                  process.stdout.write(evt.Value);
                }
                
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
            if (this.debug)
              this.logWarn("[askAgentAsyncStream] Failed to parse line:", line);
          }
        }

        emitter.emit("done");
      } catch (err: unknown) {
        this.logError("askAgentAsyncStream failed:", err);
        emitter.emit("error", err instanceof Error ? err.message : String(err));
      }
    })();

    return emitter;
  }

  askStreamingEmitter(body: Ask): EventEmitter {
    const emitter = new AskAsyncEmitter();

    (async () => {
      try {
        if (this.debug) this.logInfo("→ Opening streaming connection...");

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
                  const meta = JSON.parse(evt.Value);
                
                  emitter.emit("meta", meta);
                  break;
                case 8:
                  console.log("\n\x1b[32m[done]\x1b[0m");
                  emitter.emit("done");
                  break;
              }
            } catch {
              if (this.debug)
                this.logWarn("[askStreamingEmitter] Failed to parse:", line);
            }
          }
        }

        emitter.emit("done");
      } catch (err: unknown) {
        this.logError("askStreamingEmitter failed:", err);
        emitter.emit("error", err instanceof Error ? err.message : String(err));
      }
    })();

    return emitter;
  }

  async askStreamingRaw(body: Ask): Promise<any> {
    if (this.debug) this.logInfo("Sending raw streaming request...");
    return this.api.post("/api/Public/askstreaming", body, { responseType: "text" });
  }

  async askStreaming(body: Ask, onChunk: TextChunkHandler): Promise<void> {
    if (this.debug) this.logInfo("Processing text stream by chunks...");
    const res = await this.askStreamingRaw(body);
    await readTextStream(res, onChunk);
  }

  async *askStreamingIter(body: Ask): AsyncGenerator<string, void, unknown> {
    if (this.debug) this.logInfo("Iterating over streaming responses...");
    const res = await this.askStreamingRaw(body);
    yield* iterateTextStream(res);
  }
}
