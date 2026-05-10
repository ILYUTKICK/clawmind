import { runInference } from "@/lib/compute/zero-g-compute";

export async function runCriticAgent(
  task: string,
  plan: string,
  researchOutput: string,
  riskOutput: string,
  architectureOutput: string
) {
  return runInference({
    agentName: "critic",
    systemPrompt:
      "You are the Critic Agent in ClawMind. Review the analysis and identify the top 3-5 weak points, missing safeguards, or demo risks. Be concise.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Plan:",
      plan,
      "",
      "Research:",
      researchOutput,
      "",
      "Risks:",
      riskOutput,
      "",
      "Architecture:",
      architectureOutput,
      "",
      "Return critical feedback and improvements in 3-5 points max.",
    ].join("\n"),
  });
}