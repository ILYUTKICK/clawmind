import { runInference } from "@/lib/compute/zero-g-compute";
import { getStructuredOutputInstructions } from "@/lib/structured-output/with-structured-output";

export async function runPlannerAgent(
  task: string,
  memoryContext: string,
  model?: string,
  temperature?: number,
  maxTokens?: number
) {
  return runInference({
    agentName: "planner",
    systemPrompt: [
      "You are the Planner Agent in ClawMind.",
      "Break a Web3/AI analysis task into a clear execution plan for specialized agents.",
      "",
      "Return a JSON object with:",
      '- "steps": array of 1-8 concise step descriptions',
      '- "reasoning": brief explanation of why these steps',
      getStructuredOutputInstructions("planner"),
    ].join("\n"),
    userPrompt: [
      `Task: ${task}`,
      "",
      "Relevant memory context:",
      memoryContext || "No relevant memory context.",
      "",
      "Return the plan as a JSON object.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
  });
}
