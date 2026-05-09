import { runInference } from "@/lib/compute/zero-g-compute";

export async function runArchitectAgent(
  task: string,
  researchOutput: string,
  riskOutput: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  fallbackModel?: string,
  fallbackChain?: string[]
) {
  return runInference({
    agentName: "architect",
    systemPrompt:
      "You are the Architect Agent in ClawMind. Propose a practical architecture for a Web3/AI project using agent orchestration, 0G Compute, and 0G Storage.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Research output:",
      researchOutput,
      "",
      "Risk output:",
      riskOutput,
      "",
      "Return architecture recommendations.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
    fallbackModel,
    fallbackChain,
  });
}
