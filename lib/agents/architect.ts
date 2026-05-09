import { runInference } from "@/lib/compute/zero-g-compute";
import { getStructuredOutputInstructions } from "@/lib/structured-output/with-structured-output";

export async function runArchitectAgent(
  task: string,
  researchOutput: string,
  riskOutput: string,
  model?: string,
  temperature?: number,
  maxTokens?: number
) {
  return runInference({
    agentName: "architect",
    systemPrompt: [
      "You are the Architect Agent in ClawMind.",
      "Propose a practical architecture for a Web3/AI project using agent orchestration, 0G Compute, and 0G Storage.",
      "",
      "Return a JSON object with:",
      '- "recommendations": array of architecture recommendations',
      '- "components": array of system components',
      getStructuredOutputInstructions("architect"),
    ].join("\n"),
    userPrompt: [
      `Task: ${task}`,
      "",
      "Research output:",
      researchOutput,
      "",
      "Risk output:",
      riskOutput,
      "",
      "Return the architecture as a JSON object.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
  });
}
