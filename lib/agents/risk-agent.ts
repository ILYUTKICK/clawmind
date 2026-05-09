import { runInference } from "@/lib/compute/zero-g-compute";
import { getStructuredOutputInstructions } from "@/lib/structured-output/with-structured-output";

export async function runRiskAgent(
  task: string,
  researchOutput: string,
  memoryContext: string,
  model?: string,
  temperature?: number,
  maxTokens?: number
) {
  return runInference({
    agentName: "risk_agent",
    systemPrompt: [
      "You are the Risk Agent in ClawMind.",
      "Identify security, financial, autonomy, privacy, governance, data, and infrastructure risks.",
      "",
      "Return a JSON object with:",
      '- "risks": array of risk objects, each with "title", "severity" (low|medium|high|critical), and "explanation"',
      getStructuredOutputInstructions("risk_agent"),
    ].join("\n"),
    userPrompt: [
      `Task: ${task}`,
      "",
      "Research output:",
      researchOutput,
      "",
      "Relevant memory context:",
      memoryContext || "No relevant memory context.",
      "",
      "Return the risks as a JSON object.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
  });
}
