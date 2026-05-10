import { runInference } from "@/lib/compute/zero-g-compute";

export async function runArchitectAgent(
  task: string,
  researchOutput: string,
  riskOutput: string
) {
  const riskSection = riskOutput
    ? [
        "",
        "Risk output:",
        riskOutput,
        "",
      ].join("\n")
    : [
        "",
        "Risk output: Not yet available (running in parallel). Propose architecture based on research findings alone.",
        "",
      ].join("\n");

  return runInference({
    agentName: "architect",
    systemPrompt:
      "You are the Architect Agent in ClawMind. Propose a practical architecture for a Web3/AI project using agent orchestration, 0G Compute, and 0G Storage. Be concise and specific.",
    userPrompt: [
      `Task: ${task}`,
      "",
      "Research output:",
      researchOutput,
      riskSection,
      "Return architecture recommendations in 5-7 bullet points max.",
    ].join("\n"),
  });
}