import type { AgentCard } from "@a2a-js/sdk";
import { PublicApiClient } from "../client/PublicApi";


/**
 * Describes a single execution step in an orchestration plan.
 */
export interface OrchestrationStep {
  url: string;
  input: string;
  name: string;
}

/**
 * Defines the orchestration plan structure.
 */
export interface OrchestrationPlan {
  mode: "sequential" | "parallel";
  steps: OrchestrationStep[];
}

/**
 * Context given to the planner.
 */
export interface OrchestrationContext {
  userPrompt: string;
  availableAgents: AgentCard[];
}



/**
 * Configuration for PlannerAgent and OrchestrationManager.
 */
export interface PlannerConfig {
  llmProvider: {
    type: "openai" | "custom";
    apiKey?: string;
    endpoint?: string;
    model?: string;
  };
  signer?: any;
  fetchImpl?: typeof fetch;
  apiClient: PublicApiClient;
  
}