import { runInference } from "@/lib/compute/zero-g-compute";

export async function runRiskAgent(
  task: string,
  researchOutput: string,
  memoryContext: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  fallbackModel?: string,
  fallbackChain?: string[]
) {
  return runInference({
    agentName: "risk_agent",
    systemPrompt:
      "You are the Risk Agent in ClawMind. Identify security, financial, autonomy, privacy, governance, data, and infrastructure risks.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Research output:",
      researchOutput,
      "",
      "Relevant memory context:",
      memoryContext || "No relevant memory context.",
      "",
      "Return the most important risks with short explanations.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
    fallbackModel,
    fallbackChain,
  });
}
