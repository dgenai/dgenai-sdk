import { TimeoutError, HTTPError } from "../errors.js";
import { withRetries } from "./interceptors.js";
import type { SDKOptions } from "../types/api.types.js";

/**
 * Minimal, dependency-free HTTP client wrapping fetch
 * with timeouts, retries, and default configuration for dgenai.io.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: SDKOptions = { baseUrl: "https://api.dgenai.io" }) {
    // Force default base URL to dgenai.io unless explicitly overridden (dev purpose)
    this.baseUrl = (opts.baseUrl ?? "https://api.dgenai.io").replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.retries = opts.retries ?? 2;

    // Ensure fetch is bound to the right context depending on environment
    const fetchCandidate =
      opts.fetch ??
      (typeof window !== "undefined"
        ? window.fetch.bind(window)
        : globalThis.fetch?.bind(globalThis));

    if (!fetchCandidate) {
      throw new Error(
        "No fetch implementation available. Provide one in SDKOptions.fetch for Node < 18."
      );
    }

    this.fetchImpl = fetchCandidate;
  }

  /** Public getters to avoid (http as any) hacks */
  getBaseUrl(): string {
    return this.baseUrl;
  }
  getApiKey(): string | undefined {
    return this.apiKey;
  }
  getTimeoutMs(): number {
    return this.timeoutMs;
  }
  getRetries(): number {
    return this.retries;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
      ...extra,
    };
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new TimeoutError(this.timeoutMs)), this.timeoutMs);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }

  async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return withRetries(async () => this.request<T>(url, { method: "GET" }), this.retries);
  }

  async head(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    return withRetries(async () => this.raw(url, { method: "HEAD" }), this.retries);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>(url, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** Perform a request and parse JSON when applicable. */
  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await this.raw(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => undefined);
      throw new HTTPError(`HTTP ${res.status} for ${url}`, res.status, text);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json") || contentType.includes("text/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  /** Raw fetch with headers and timeout. */
  async raw(url: string, init: RequestInit): Promise<Response> {
    const finalInit: RequestInit = {
      ...init,
      headers: this.headers(init.headers),
    };
    return this.withTimeout(this.fetchImpl(url, finalInit));
  }
}
