import { A2AClient } from "@a2a-js/sdk/client";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import type { MessageSendParams } from "@a2a-js/sdk";
import { wrapFetchWithPayment } from "x402-fetch";
import { extractText } from "../utils/extractText.js";

/**
 * EventEmitter-based wrapper for streaming A2A messages.
 */
export class A2AEmitter extends EventEmitter {}

/**
 * Service layer to interact with A2A agents via A2AClient.
 * The fetchImpl must already be x402-aware if the agent requires payment.
 */
export class A2AService {
  static async send(
    agentCardUrl: string,
    input: string,
    metadata?: Record<string, any>,
    signer?: any,
    fetchImpl: typeof fetch = globalThis.fetch
  ): Promise<string> {
    // Cast to fix type incompatibility between URL and RequestInfo
    const x402Fetch = (signer
      ? wrapFetchWithPayment(fetchImpl, signer)
      : fetchImpl) as typeof fetch;

    const client = await A2AClient.fromCardUrl(agentCardUrl, { fetchImpl: x402Fetch });

    const params: MessageSendParams = {
      message: {
        kind: "message",
        messageId: uuidv4(),
        role: "user",
        parts: [{ kind: "text", text: input, metadata: metadata ?? {} }],
      },
    };

    const stream = await client.sendMessageStream(params);
    let result = "";

    for await (const chunk of stream) {
      if (chunk.kind === "artifact-update") {
        for (const part of chunk.artifact.parts ?? []) {
          if (part.kind === "text" && part.text) result += part.text;
        }
      }
    }

    return result;
  }

  static async stream(
    agentCardUrl: string,
    input: string,
    metadata?: Record<string, any>,
    signer?: any,
    fetchImpl: typeof fetch = globalThis.fetch
  ): Promise<A2AEmitter> {
    const emitter = new A2AEmitter();

    (async () => {
      try {
        // Cast to avoid the RequestInfo/URL type issue
        const x402Fetch = (signer
          ? wrapFetchWithPayment(fetchImpl, signer)
          : fetchImpl) as typeof fetch;

        const client = await A2AClient.fromCardUrl(agentCardUrl, { fetchImpl: x402Fetch });

        const params: MessageSendParams = {
          message: {
            kind: "message",
            messageId: uuidv4(),
            role: "user",
            parts: [{ kind: "text", text: input, metadata: metadata ?? {} }],
          },
        };

        // x402-fetch handles 402 payment responses → no manual "probe" required
        const stream = await client.sendMessageStream(params);

        for await (const chunk of stream) {
          switch (chunk.kind) {
            case "artifact-update":
              for (const part of chunk.artifact.parts ?? [])
                if (part.kind === "text" && part.text)
                  emitter.emit("message", part.text);
              break;

            case "status-update":
              emitter.emit(
                "status",
                `${chunk.status.state}${
                  chunk.status.message ? " " + extractText(chunk.status.message) : ""
                }`
              );
              break;

            case "task":
              emitter.emit("meta", { taskId: chunk.id });
              break;
          }
        }

        emitter.emit("done");
      } catch (err) {
        emitter.emit("error", err instanceof Error ? err.message : String(err));
      }
    })();

    return emitter;
  }

  static async cancel(
    agentCardUrl: string,
    taskId: string,
    signer?: any,
    fetchImpl: typeof fetch = globalThis.fetch
  ): Promise<void> {
    // Ensure x402-aware fetch when using payment signer
    const x402Fetch = (signer
      ? wrapFetchWithPayment(fetchImpl, signer)
      : fetchImpl) as typeof fetch;

    const client = await A2AClient.fromCardUrl(agentCardUrl, { fetchImpl: x402Fetch });
    await client.cancelTask({ id: taskId });
  }
}
