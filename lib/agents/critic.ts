import { runInference } from "@/lib/compute/zero-g-compute";
import { getStructuredOutputInstructions } from "@/lib/structured-output/with-structured-output";

// ---------------------------------------------------------------------------
// ClawMind — Adversarial Critic Agent
// ---------------------------------------------------------------------------
// Key design: This agent runs on a DIFFERENT model family than the other
// agents (GLM-5.1-FP8 by default, vs deepseek for Planner/Final). This
// prevents self-confirmation bias — the Critic's training data, RLHF priors,
// and refusal patterns are fundamentally different from the agents it reviews.
//
// Temperature is set to 0.8 (higher than the 0.1-0.3 of other agents) to
// encourage divergent thinking and surface risks that a low-temperature
// pass would miss.
// ---------------------------------------------------------------------------

export async function runCriticAgent(
  task: string,
  plan: string,
  researchOutput: string,
  riskOutput: string,
  architectureOutput: string,
  model?: string,
  temperature?: number,
  maxTokens?: number
) {
  // Use adversarial temperature if not explicitly overridden
  const adversarialTemperature = temperature ?? 0.8;

  return runInference({
    agentName: "critic",
    systemPrompt: [
      "You are the Adversarial Critic Agent in ClawMind — a hostile reviewer running on a DIFFERENT model family than the agents you review.",
      "",
      "Your job is NOT to validate or summarize. Your job is to ATTACK the analysis.",
      "",
      "Rules of engagement:",
      "- Find what previous agents MISSED, not what they found.",
      "- DISAGREE when the reasoning is shallow or the evidence is thin.",
      "- Identify blind spots: What assumptions did the Planner take for granted? What risks did the Risk Agent ignore? What components did the Architect overlook?",
      "- Cite SPECIFIC claims from the analysis that are unsupported or under-supported.",
      "- Flag any optimism bias — agents tend to recommend INVESTIGATE_MORE when they should say NO_GO.",
      "- Challenge the score: if you think the score is too high, say so explicitly and explain why.",
      "- NEVER just agree. If you can't find anything to criticize, you're not trying hard enough.",
      "",
      "Return a JSON object with:",
      '- "critiques": array of hostile critical observations (each must cite a specific claim from the analysis)',
      '- "missingSafeguards": array of missing safety measures that the other agents failed to identify',
      '- "improvements": array of suggested improvements that directly address the weaknesses you found',
      getStructuredOutputInstructions("critic"),
    ].join("\n"),
    userPrompt: [
      `Task: ${task}`,
      "",
      "=== ANALYSIS TO ATTACK ===",
      "",
      "Plan:",
      plan,
      "",
      "Research output:",
      researchOutput,
      "",
      "Risk output:",
      riskOutput,
      "",
      "Architecture output:",
      architectureOutput,
      "",
      "=== YOUR MISSION ===",
      "Tear this analysis apart. Find what they missed. Challenge their assumptions. Be specific.",
      "",
      "Return the critique as a JSON object.",
    ].join("\n"),
    model,
    temperature: adversarialTemperature,
    maxTokens,
  });
}
