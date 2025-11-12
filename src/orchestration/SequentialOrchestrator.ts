import type { OrchestrationPlan } from "../types/orchestration.types.js";
import { PublicApiClient } from "../client/PublicApi.js";


/**
 * Executes an orchestration plan sequentially, passing outputs between agents.
 * 
 * Supports the following input tokens inside each step:
 * - {{lastOutput}}  → the output of the previous step
 * - {{allOutputs}}  → the concatenated outputs of all previous steps
 * - {{stepN}}       → the output of a specific step (1-based index)
 */
export class SequentialOrchestrator {
  constructor(
    private readonly apiClient: PublicApiClient,
  ) {}

  /**
   * Runs a sequential orchestration plan by streaming outputs from each agent step.
   * 
   * @param plan - The orchestration plan containing sequential steps to execute.
   * @param onProgress - Optional callback to report intermediate updates, such as text, status, meta, or errors.
   * @returns The final aggregated output produced by the last step.
   */
  async run(
    plan: OrchestrationPlan,
    onProgress?: (update: {
      step: string;
      type: "text" | "status" | "meta" | "done" | "error";
      data?: string;
    }) => void
  ): Promise<string> {
    if (plan.mode !== "sequential") {
      throw new Error(`Unsupported plan mode: ${plan.mode}`);
    }

    const outputs: string[] = []; // Keep a full history of step outputs

    for (const [i, step] of plan.steps.entries()) {
      const label = step.name ?? step.url;

      // Dynamically resolve input placeholders based on previous outputs
      let resolvedInput = step.input
        .replace(/\{\{lastOutput\}\}/g, outputs.at(-1) ?? "")
        .replace(/\{\{allOutputs\}\}/g, outputs.join("\n\n"))
        .replace(/\{\{step(\d+)\}\}/g, (_, idx) => outputs[parseInt(idx) - 1] ?? "");

      onProgress?.({
        step: label,
        type: "status",
        data: `Starting step ${i + 1}/${plan.steps.length}`,
      });

      // Stream the response from the current agent
      const emitter = await this.apiClient.askAgentStream(step.url, resolvedInput, {
        orchestrationStep: i + 1,
      });

      let stepOutput = "";

      await new Promise<void>((resolve, reject) => {
        emitter.on("message", (chunk: string) => {
          stepOutput += chunk;
          onProgress?.({ step: label, type: "text", data: chunk });
        });

        emitter.on("status", (status: string) => {
          onProgress?.({ step: label, type: "status", data: status });
        });

        emitter.on("meta", (meta: any) => {
          onProgress?.({ step: label, type: "meta", data: JSON.stringify(meta) });
        });

        emitter.on("done", () => {
          onProgress?.({ step: label, type: "done" });
          resolve();
        });

        emitter.on("error", (err: string) => {
          onProgress?.({ step: label, type: "error", data: err });
          reject(new Error(err));
        });
      });

      // Store the trimmed output for future references
      outputs.push(stepOutput.trim());
    }

    // Return the last output as the final orchestration result
    return outputs.at(-1) ?? "";
  }
}
