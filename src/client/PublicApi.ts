import { HttpClient } from "../http/HttpClient.js";
import { A2AService, A2AEmitter } from "../services/a2aService.js";
import type { AgentListResponse } from "../types/agents.types.js";

/**
 * Public API client using fetch (x402-compatible).
 * Axios and interceptors are fully removed.
 */
export class PublicApiClient {
  private debug: boolean;

  constructor(
    private readonly http: HttpClient,
    private readonly signer?: any,
    private readonly network?: string,
    debugMode = false,
    private readonly fetchImpl: typeof fetch = globalThis.fetch
  ) {
    this.debug = debugMode || process.env.DEBUG_X402 === "true";
  }

  /** Retrieve all available agents */
  async listAgents(): Promise<AgentListResponse> {
    return this.http.get<AgentListResponse>("/api/Public/agents");
  }

  /** Send a single A2A message (non-streaming) */
  async askAgentSend(
    agentCardUrl: string,
    input: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return A2AService.send(agentCardUrl, input, metadata, this.signer, this.fetchImpl);
  }

  /** Send an A2A message as a stream (SSE) */
  async askAgentStream(
    agentCardUrl: string,
    input: string,
    metadata?: Record<string, any>
  ): Promise<A2AEmitter> {
    return A2AService.stream(agentCardUrl, input, metadata, this.signer, this.fetchImpl);
  }

  /** Cancel an existing A2A task */
  async cancelTask(agentCardUrl: string, taskId: string): Promise<void> {
    return A2AService.cancel(agentCardUrl, taskId, this.signer, this.fetchImpl);
  }
}
