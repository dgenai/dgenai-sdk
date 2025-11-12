import OpenAI from "openai";
import type { OrchestrationPlan, OrchestrationContext, PlannerConfig } from "../types/orchestration.types";

/**
 * Internal orchestration planner.
 * Uses an LLM backend (OpenAI by default) to decide which A2A agents should be used
 * and in what order based on the user prompt.
 *
 * This class never reads environment variables — it must be configured explicitly
 * via PlannerConfig provided by the SDK or client application.
 */
export class PlannerAgent {
  private llm: OpenAI;
  private model: string;

  constructor(private readonly config: PlannerConfig) {
    if (config.llmProvider.type !== "openai") {
      throw new Error("Only OpenAI provider is currently supported.");
    }

    this.llm = new OpenAI({
      apiKey: config.llmProvider.apiKey,
      baseURL: config.llmProvider.endpoint,
    });

    this.model = config.llmProvider.model || "o3-mini";

  }

  /**
   * Analyzes the orchestration context and returns a structured execution plan.
   */
  async plan(context: OrchestrationContext): Promise<OrchestrationPlan> {
    const systemPrompt = `
You are an internal AI orchestration planner.
You decide which AI agents to invoke and in what sequence based on the user request.
`;

const userPrompt = `
You are a reasoning engine that creates a multi-agent orchestration plan.

You have access only to the following agents:

${context.availableAgents.map(a => 
  `- ${a.name} (url: ${a.url})
    Description: ${a.description ?? "No description"}
    Skills:
    ${a.skills?.length 
      ? a.skills.map(s => `  • ${s.name}: ${s.description.split("\n")[0]}`).join("\n")
      : "  • None"}`).join("\n\n")}

---

USER REQUEST:
"${context.userPrompt}"

---

### Your task:
Analyze the request and determine if it requires collaboration between multiple agents.

- If the request is simple, use **one** agent.
- If it requires research, validation, or analysis from multiple perspectives, use **several agents** in sequence.
- Reuse outputs from previous agents when helpful (use {{lastOutput}} or {{allOutputs}} when later agents may benefit from earlier context).

---

### Output format (MUST be valid JSON):
{
  "mode": "sequential",
  "steps": [
    {
      "name": "<agent name>",
      "url": "<one of the listed agent URLs>",
      "input": "<text or instruction to send to this agent>"
    },
    ...
  ]
}

Do not invent new agents or URLs. 
Always include at least one step.
Respond with **JSON only** — no commentary or markdown.
`;



const response = await this.llm.responses.create({
  model: this.model, // ex: "o3-mini" si tu as accès
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ],
});





    const content = response?.output_text?.trim() ?? "";

    try {
      return JSON.parse(content) as OrchestrationPlan;
    } catch (err) {
      throw new Error(`PlannerAgent produced invalid JSON: ${content}`);
    }
  }
}