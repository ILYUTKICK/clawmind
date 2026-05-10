import { runInference } from "@/lib/compute/zero-g-compute";

export type CriticChallenge = {
  challenge: string;
  severity: "low" | "medium" | "high";
  explanation: string;
};

export type CriticOutput = {
  challenges: CriticChallenge[];
  summary: string;
};

function normalizeSeverity(value: unknown): CriticChallenge["severity"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return "medium";
}

function normalizeCriticOutput(value: unknown): CriticOutput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<CriticOutput>;

  if (!Array.isArray(candidate.challenges)) {
    return null;
  }

  const challenges = candidate.challenges
    .map((item): CriticChallenge | null => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const challenge = item as Partial<CriticChallenge>;
      const title =
        typeof challenge.challenge === "string" && challenge.challenge.trim().length > 0
          ? challenge.challenge.trim()
          : "";

      if (!title) {
        return null;
      }

      return {
        challenge: title,
        severity: normalizeSeverity(challenge.severity),
        explanation:
          typeof challenge.explanation === "string" && challenge.explanation.trim().length > 0
            ? challenge.explanation.trim()
            : "The critic flagged this as a material issue requiring reconciliation.",
      };
    })
    .filter((item): item is CriticChallenge => item !== null)
    .slice(0, 5);

  return {
    challenges,
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim().length > 0
        ? candidate.summary.trim()
        : challenges.length > 0
          ? "Critic found material challenges."
          : "Critic found no material challenges.",
  };
}

function extractCriticJson(rawOutput: string): CriticOutput | null {
  try {
    const cleanedOutput = rawOutput
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/```json/gi, "```")
      .replace(/,\s*([}\]])/g, "$1");

    const fencedMatch = cleanedOutput.match(/```\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]?.trim() ?? cleanedOutput;

    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    const jsonCandidate = candidate.slice(firstBrace, lastBrace + 1).replace(/,\s*([}\]])/g, "$1");
    return normalizeCriticOutput(JSON.parse(jsonCandidate) as unknown);
  } catch {
    return null;
  }
}

export async function runCriticAgent(
  task: string,
  plan: string,
  researchOutput: string,
  riskOutput: string,
  architectureOutput: string
): Promise<CriticOutput> {
  const rawOutput = await runInference({
    agentName: "critic",
    systemPrompt: [
      "You are the Critic Agent in ClawMind. Your role is adversarial review.",
      "Identify 2-4 critical weak points, missing safeguards, or demo risks.",
      "Be specific and severity-rated.",
      "Only use HIGH for direct custody, signing, private-key, oracle-manipulation, governance-takeover, or irreversible-funds-loss issues.",
      "Use MEDIUM for uncertainty that needs investigation, and LOW for polish or incomplete evidence.",
      "",
      "CRITICAL OUTPUT RULES:",
      "1. Return exactly one valid JSON object.",
      "2. The first character must be {.",
      "3. The last character must be }.",
      "4. Do not use markdown or backticks.",
      "5. Use double quotes for all keys and strings.",
      "6. No trailing commas.",
      "7. Do not add prose outside the JSON.",
      "",
      "Return this exact shape:",
      "{",
      '  "challenges": [',
      '    {',
      '      "challenge": "string: title of the issue",',
      '      "severity": "high",',
      '      "explanation": "string: why this matters"',
      "    }",
      "  ],",
      '  "summary": "string: 1-sentence bottom line"',
      "}",
      "",
      "Severity levels:",
      "- high: This breaks the system or enables serious harm if unfixed.",
      "- medium: This degrades trust or creates a workaround path.",
      "- low: This is a polish or edge case issue.",
    ].join("\n"),
    userPrompt: [
      `Task: ${task}`,
      "",
      "Plan:",
      plan,
      "",
      "Research findings:",
      researchOutput,
      "",
      "Identified risks:",
      riskOutput,
      "",
      "Proposed architecture:",
      architectureOutput,
      "",
      "Challenge the above. Identify blind spots, optimism bias, and missing defenses.",
      "Return exactly one valid JSON object only. No markdown. No prose.",
    ].join("\n"),
  });

  const parsed = extractCriticJson(rawOutput);

  if (parsed !== null) {
    return parsed;
  }

  // Fallback if parsing fails
  return {
    challenges: [
      {
        challenge: "Model output could not be parsed",
        severity: "low",
        explanation: "The critic agent returned non-JSON output. This is a recoverable fallback.",
      },
    ],
    summary: "Fallback: unable to parse critic output.",
  };
}
