import { runInference } from "@/lib/compute/zero-g-compute";

export async function runPlannerAgent(
  task: string,
  memoryContext: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  fallbackModel?: string,
  fallbackChain?: string[]
) {
  return runInference({
    agentName: "planner",
    systemPrompt:
      "You are the Planner Agent in ClawMind. Break a Web3/AI analysis task into a clear execution plan for specialized agents.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Relevant memory context:",
      memoryContext || "No relevant memory context.",
      "",
      "Return a concise step-by-step plan.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
    fallbackModel,
    fallbackChain,
  });
}
