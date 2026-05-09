import { runInference } from "@/lib/compute/zero-g-compute";
import { getStructuredOutputInstructions } from "@/lib/structured-output/with-structured-output";

export async function runResearchAgent(
  task: string,
  plan: string,
  model?: string,
  temperature?: number,
  maxTokens?: number
) {
  return runInference({
    agentName: "researcher",
    systemPrompt: [
      "You are the Research Agent in ClawMind.",
      "Extract facts, assumptions, missing context, and useful signals from the user task and plan.",
      "",
      "Return a JSON object with:",
      '- "facts": array of extracted facts',
      '- "assumptions": array of assumptions made',
      '- "missingContext": array of missing information needed',
      getStructuredOutputInstructions("researcher"),
    ].join("\n"),
    userPrompt: [
      `Task: ${task}`,
      "",
      "Planner output:",
      plan,
      "",
      "Return the research findings as a JSON object.",
    ].join("\n"),
    model,
    temperature,
    maxTokens,
  });
}
