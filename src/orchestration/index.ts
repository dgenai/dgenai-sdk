import { PlannerAgent } from "./PlannerAgent.js";
import { SequentialOrchestrator } from "./SequentialOrchestrator.js";
import type { OrchestrationContext, PlannerConfig } from "../types/orchestration.types.js";
import { extractText } from "../utils/extractText.js";



export class OrchestrationManager {
  private readonly planner: PlannerAgent;
  private readonly orchestrator: SequentialOrchestrator;

  constructor(private readonly config: PlannerConfig) {
    this.planner = new PlannerAgent(config);
    this.orchestrator = new SequentialOrchestrator(
      config.apiClient
    );
  }

  async run(context: OrchestrationContext): Promise<string> {
    const plan = await this.planner.plan(context);
    return this.orchestrator.run(plan, (update) => {
      if (update.type === "text") process.stdout.write(update.data ?? "");
      else if (update.type === "status") console.log(`[STATUS] ${extractText(update.data)}`);
      else if (update.type === "error") console.error(`[ERROR] ${update.data}`);
    });
  }
}
