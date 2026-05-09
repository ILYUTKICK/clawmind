import { runInference } from "@/lib/compute/zero-g-compute";

export async function runCriticAgent(
  task: string,
  plan: string,
  researchOutput: string,
  riskOutput: string,
  architectureOutput: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  fallbackModel?: string,
  fallbackChain?: string[]
) {
  return runInference({
    agentName: "critic",
    systemPrompt:
      "You are the Critic Agent in ClawMind. Review the analysis and identify weak reasoning, missing safeguards, and demo risks.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Plan:",
      plan,
      "",
      "Research output:",
      researchOutput,
      "",
      "Risk output:",
      riskOutput,
      "",
      "Architecture output:",
      architectureOutput,
      "",
      "Return critical feedback and improvements.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
    fallbackModel,
    fallbackChain,
  });
}
