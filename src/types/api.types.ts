/**
 * High-level SDK types and helpers not strictly part of the Swagger schema.
 */
export type UUID = string;

export interface SDKOptions {
  baseUrl?: string;
  /** X-Api-Key header value. Use your in-app wallet address. */
  apiKey?: string;
  /** Default request timeout in milliseconds. */
  timeoutMs?: number;
  /** Number of automatic retries for idempotent GET/HEAD. */
  retries?: number;
  /** Optional fetch implementation (Node polyfills, test, etc.). */
  fetch?: typeof globalThis.fetch;
}

/** Streaming callback signature used by askStreaming. */
export type TextChunkHandler = (chunk: string) => void | Promise<void>;
