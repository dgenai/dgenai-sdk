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

export interface Pagination {
  skip?: number;
  count?: number;
}

export interface ChatMessage {
  /** Raw message payload as returned by the server. */
  raw: unknown;
}

export interface HeadResult {
  /** True if the resource exists and you are allowed to access it. */
  ok: boolean;
  /** Optional HTTP status code. */
  status: number;
}

/** Streaming callback signature used by askStreaming. */
export type TextChunkHandler = (chunk: string) => void | Promise<void>;
