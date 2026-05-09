import { runInference } from "@/lib/compute/zero-g-compute";

export async function runResearchAgent(
  task: string,
  plan: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  fallbackModel?: string,
  fallbackChain?: string[]
) {
  return runInference({
    agentName: "researcher",
    systemPrompt:
      "You are the Research Agent in ClawMind. Extract facts, assumptions, missing context, and useful signals from the user task and plan.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Planner output:",
      plan,
      "",
      "Return extracted facts and assumptions.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
    fallbackModel,
    fallbackChain,
  });
}
