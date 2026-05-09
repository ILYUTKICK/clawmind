import { AnalysisReport, MemoryRecord, Recommendation, RiskItem, RiskSeverity } from "@/lib/types";
import { runInference } from "@/lib/compute/zero-g-compute";

type FinalAgentInput = {
  task: string;
  memories: MemoryRecord[];
  plan: string;
  researchOutput: string;
  riskOutput: string;
  architectureOutput: string;
  critiqueOutput: string;
};

type FinalAgentJson = {
  summary?: unknown;
  score?: unknown;
  recommendation?: unknown;
  risks?: unknown;
  opportunities?: unknown;
  architecture?: unknown;
  nextSteps?: unknown;
  evidence?: unknown;
};

function clampScore(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 65;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function normalizeRecommendation(value: unknown): Recommendation {
  if (value === "GO" || value === "NO_GO" || value === "INVESTIGATE_MORE") {
    return value;
  }

  return "INVESTIGATE_MORE";
}

function normalizeSeverity(value: unknown): RiskSeverity {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  return "medium";
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeRisks(value: unknown, fallback: RiskItem[]): RiskItem[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const risks = value
    .map((item): RiskItem | null => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const candidate = item as Partial<RiskItem>;

      if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) {
        return null;
      }

      return {
        title: candidate.title.trim(),
        severity: normalizeSeverity(candidate.severity),
        explanation:
          typeof candidate.explanation === "string" && candidate.explanation.trim().length > 0
            ? candidate.explanation.trim()
            : "The agent flagged this as a material risk that requires further validation.",
      };
    })
    .filter((item): item is RiskItem => item !== null)
    .slice(0, 6);

  return risks.length > 0 ? risks : fallback;
}

function extractJsonObject(rawOutput: string): FinalAgentJson | null {
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

  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as FinalAgentJson;
  } catch {
    return null;
  }
}

function calculateFallbackScore(risks: RiskItem[]): number {
  const penaltyBySeverity: Record<RiskSeverity, number> = {
    low: 2,
    medium: 5,
    high: 8,
    critical: 12,
  };

  const totalPenalty = risks.reduce((sum, risk) => {
    return sum + penaltyBySeverity[risk.severity];
  }, 0);

  return Math.max(0, Math.min(100, 100 - totalPenalty));
}

function createFallbackReport(input: FinalAgentInput): AnalysisReport {
  const memoryRiskHints = Array.from(new Set(input.memories.flatMap((memory) => memory.risks))).slice(0, 3);

  const risks: RiskItem[] = [
    {
      title: "Autonomous execution risk",
      severity: "high",
      explanation:
        "If an AI agent can trigger transactions or operational decisions without strict constraints, a wrong model output may create real financial or security damage.",
    },
    {
      title: "Custody and permission risk",
      severity: "critical",
      explanation:
        "Any workflow involving user funds, delegated wallets, or signing permissions must separate reasoning from execution and enforce hard policy limits.",
    },
    {
      title: "External data reliability risk",
      severity: "high",
      explanation:
        "The agent may depend on APY, price, liquidity, protocol health, or market data that can be stale, manipulated, or incomplete.",
    },
    {
      title: "Memory poisoning risk",
      severity: "medium",
      explanation:
        "Persistent agent memory improves long-context reasoning, but malicious or low-quality memories can bias future decisions.",
    },
  ];

  return {
    summary:
      "The project has strong potential as a persistent multi-agent decision system, but it becomes high-risk if autonomous agents can directly influence user funds, protocol execution, or security-sensitive workflows.",
    score: calculateFallbackScore(risks),
    recommendation: "INVESTIGATE_MORE",
    risks,
    opportunities: [
      "Persistent memory lets the agent reuse previous risk patterns instead of starting from zero.",
      "0G Compute can act as the inference layer for modular agent calls.",
      "0G Storage can store reports, agent logs, and long-term memory records.",
      "A verifiable decision receipt can make AI-generated reports easier to audit.",
      ...memoryRiskHints.map((risk) => `Previous memory suggests prioritizing: ${risk}.`),
    ],
    architecture: [
      "Use a multi-agent pipeline: Memory Retrieval → Planner → Researcher → Risk Agent → Architect → Critic → Final Agent.",
      "Use 0G Compute as the LLM inference backend for each agent node.",
      "Use 0G Storage to persist final reports, pipeline logs, and memory summaries.",
      "Keep execution permissions outside the LLM and enforce deterministic policy checks.",
      "Generate a report hash and storage reference for every analysis result.",
    ],
    nextSteps: [
      "Load latest memory index from 0G Storage before ranking memories.",
      "Add document upload or URL analysis for whitepapers, GitHub READMEs, and protocol docs.",
      "Add semantic memory ranking with embeddings.",
      "Expose OpenClaw-compatible orchestration metadata in the repository root.",
      "Prepare final pitch/demo video with real 0G receipts.",
    ],
    evidence: [
      `User task: ${input.task}`,
      `Relevant memories used: ${input.memories.length}`,
      "Pipeline completed with planner, researcher, risk, architect, critic, and final decision agents.",
      "Report generation mode: FALLBACK_RISK_BASED_SCORE.",
      "Fallback report was generated because the final model output could not be parsed as strict JSON.",
    ],
  };
}

function buildReportFromModelOutput(input: FinalAgentInput, rawOutput: string): AnalysisReport {
  const parsed = extractJsonObject(rawOutput);
  const fallback = createFallbackReport(input);

  if (parsed === null) {
    return fallback;
  }

  const modelEvidence = normalizeStringArray(parsed.evidence, fallback.evidence);

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : fallback.summary,
    score: clampScore(parsed.score),
    recommendation: normalizeRecommendation(parsed.recommendation),
    risks: normalizeRisks(parsed.risks, fallback.risks),
    opportunities: normalizeStringArray(parsed.opportunities, fallback.opportunities),
    architecture: normalizeStringArray(parsed.architecture, fallback.architecture),
    nextSteps: normalizeStringArray(parsed.nextSteps, fallback.nextSteps),
    evidence: [
      "Report generation mode: MODEL_JSON.",
      `Relevant memories used: ${input.memories.length}`,
      ...modelEvidence,
    ].slice(0, 10),
  };
}

export async function runFinalAgent(input: FinalAgentInput): Promise<{
  rawOutput: string;
  report: AnalysisReport;
}> {
  const rawOutput = await runInference({
    agentName: "final_agent",
    systemPrompt: [
    "You are the Final Decision Agent in ClawMind.",
    "You must generate the final structured decision report.",
    "",
    "CRITICAL OUTPUT RULES:",
    "1. Return exactly one valid JSON object.",
    "2. The first character of your response must be {.",
    "3. The last character of your response must be }.",
    "4. Do not use markdown.",
    "5. Do not use triple backticks.",
    "6. Do not add prose before or after the JSON.",
    "7. Do not add comments.",
    "8. Do not use trailing commas.",
    "9. Use double quotes for every JSON key and string value.",
    "10. The score must be a number from 0 to 100.",
    "",
    "The JSON object must match this exact shape:",
    "{",
    '  "summary": "string",',
    '  "score": 0,',
    '  "recommendation": "GO",',
    '  "risks": [',
    '    {',
    '      "title": "string",',
    '      "severity": "low",',
    '      "explanation": "string"',
    '    }',
    "  ],",
    '  "opportunities": ["string"],',
    '  "architecture": ["string"],',
    '  "nextSteps": ["string"],',
    '  "evidence": ["string"]',
    "}",
    "",
    "Allowed recommendation values:",
    "- GO",
    "- NO_GO",
    "- INVESTIGATE_MORE",
    "",
    "Allowed severity values:",
    "- low",
    "- medium",
    "- high",
    "- critical",
  ].join("\n"),
    userPrompt: [
      `Task: ${input.task}`,
      "",
      "Relevant memories:",
      input.memories
        .map((memory) => `- ${memory.summary} Risks: ${memory.risks.join(", ")}. Score: ${memory.score}.`)
        .join("\n") || "No relevant memories.",
      "",
      "Plan:",
      input.plan,
      "",
      "Research:",
      input.researchOutput,
      "",
      "Risks:",
      input.riskOutput,
      "",
      "Architecture:",
      input.architectureOutput,
      "",
      "Critique:",
      input.critiqueOutput,
      "",
      "Prioritize safety, verifiability, memory persistence, 0G infrastructure usage, and OpenClaw-compatible orchestration.",
      "Return exactly one valid JSON object only. No markdown. No prose. No trailing commas.",
    ].join("\n"),
  });

  const report = buildReportFromModelOutput(input, rawOutput);

  return {
    rawOutput,
    report,
  };
}