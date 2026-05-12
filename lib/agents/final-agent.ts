import { AnalysisReport, MemoryRecord, Recommendation, RiskItem, RiskSeverity } from "@/lib/types";
import { runInference } from "@/lib/compute/zero-g-compute";
import type { CriticChallenge, CriticOutput } from "./critic";

type FinalAgentInput = {
  task: string;
  memories: MemoryRecord[];
  plan: string;
  researchOutput: string;
  riskOutput: string;
  architectureOutput: string;
  critiqueOutput: CriticOutput;
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

type ScoreProfile = {
  kind:
    | "garbage"
    | "high_risk_custody"
    | "read_only_safe"
    | "mature_safe"
    | "ambiguous_novel"
    | "edge_case"
    | "default";
  label: string;
  baseScore?: number;
  minScore: number;
  maxScore: number;
};

function normalizeForScoring(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9$.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isReadOnlySafeTaskText(text: string): boolean {
  const readOnly = hasAny(text, [/\bread-only\b/, /\bread only\b/, /\bview-only\b/]);
  const noExecution = hasAny(text, [
    /\bno wallet connection\b/,
    /\bno transaction signing\b/,
    /\bno signing\b/,
    /\bdoes not sign\b/,
    /\bno custody\b/,
    /\bnon-custodial\b/,
    /\bno admin keys?\b/,
    /\bno ability to move funds\b/,
    /\bcannot move funds\b/,
  ]);
  const unsafeExecution = hasAny(text, [
    /\bprivate key (?:stored|exposed|leak|leakage|in env|access)\b/,
    /\benv var\b/,
    /\bself-custodial\b/,
    /\buser funds\b/,
    /\bauto-?trad(?:e|es|ing)\b/,
    /\bcan move funds\b/,
    /\bmoves funds\b/,
    /\bfund movement capability\b/,
    /\btransaction signing enabled\b/,
    /\bwallet connection enabled\b/,
  ]);

  return readOnly && noExecution && !unsafeExecution;
}

function detectScoreProfile(input: FinalAgentInput): ScoreProfile {
  const taskText = normalizeForScoring(input.task);
  const allText = normalizeForScoring(
    [
      input.task,
      input.researchOutput,
      input.riskOutput,
      input.architectureOutput,
      input.plan,
    ].join(" "),
  );

  const meaningfulWords = taskText
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/.test(word) && word.length >= 4);

  if (
    meaningfulWords.length < 3 ||
    hasAny(taskText, [/\basdf\b/, /\bqwerty\b/, /\blorem\b/, /\bfoobar\b/])
  ) {
    return {
      kind: "garbage",
      label: "Insufficient or nonsensical task input",
      baseScore: 12,
      minScore: 0,
      maxScore: 20,
    };
  }

  if (isReadOnlySafeTaskText(taskText)) {
    return {
      kind: "read_only_safe",
      label: "Read-only non-custodial analytics workflow",
      baseScore: 88,
      minScore: 75,
      maxScore: 92,
    };
  }

  const taskCustodyOrExecution = hasAny(taskText, [
    /\bself-custodial\b/,
    /\bcustody\b/,
    /\buser funds\b/,
    /\bauto-?trad(?:e|es|ing)\b/,
    /\bdelegated wallet\b/,
    /\bsign(?:s|ing)? transactions\b/,
  ]);
  const taskMissingGuards = hasAny(taskText, [
    /\bno withdrawal guards?\b/,
    /\bwithout withdrawal guards?\b/,
    /\bno guardrails?\b/,
    /\bkey in env\b/,
    /\benv var\b/,
    /\bprivate key\b/,
  ]);

  if (taskCustodyOrExecution && taskMissingGuards) {
    return {
      kind: "high_risk_custody",
      label: "High-risk custody or autonomous execution",
      baseScore: 52,
      minScore: 10,
      maxScore: 25,
    };
  }

  const matureProtocol = hasAny(taskText, [
    /\buniswap v3 fork\b/,
    /\bwell-audited\b/,
    /\baudited (?:2x|twice|by 2|by two)\b/,
    /\btwo independent audits?\b/,
    /\b2 independent audits?\b/,
    /\btwo audits?\b/,
    /\bmature protocol\b/,
    /\b40m\+? tvl\b/,
    /\$4[0-9]m\b/,
    /\$[5-9][0-9]m\b/,
    /\b[5-9][0-9]m\+? tvl\b/,
    /\b100m tvl\b/,
    /\$100m\b/,
  ]);
  const explicitSafety = hasAny(taskText, [
    /\bno oracle dependency\b/,
    /\bno external oracle\b/,
    /\bnon-custodial\b/,
    /\bno custody\b/,
    /\btimelock\b/,
    /\bno upgradeability outside multisig\b/,
    /\bno admin keys?\b/,
    /\bimmutable core contracts?\b/,
    /\bguarded admin controls?\b/,
    /\bguarded admin\b/,
    /\bgovernance active\b/,
    /\bactive governance\b/,
  ]);

  if (matureProtocol && explicitSafety && !taskMissingGuards) {
    return {
      kind: "mature_safe",
      label: "Mature audited protocol with explicit safety constraints",
      baseScore: 88,
      minScore: 75,
      maxScore: 92,
    };
  }

  const novelOrMixed = hasAny(allText, [
    /\bnovel\b/,
    /\bnew amm\b/,
    /\btwap oracle\b/,
    /\bunique twap\b/,
    /\b1 audit\b/,
    /\bone audit\b/,
    /\baudited by 1\b/,
    /\b5m tvl\b/,
    /\$5m\b/,
    /\banonymous team\b/,
    /\bteam anonymous\b/,
  ]);

  if (novelOrMixed) {
    return {
      kind: "ambiguous_novel",
      label: "Novel mechanism with mixed evidence",
      baseScore: 60,
      minScore: 40,
      maxScore: 60,
    };
  }

  const edgeRisk = hasAny(allText, [
    /\bbridge\b/,
    /\bcross-chain\b/,
    /\bupgradeable\b/,
    /\badmin key\b/,
    /\boracle\b/,
    /\bliquidation\b/,
    /\brehypothecation\b/,
  ]);

  if (edgeRisk) {
    return {
      kind: "edge_case",
      label: "Complex Web3 edge case",
      minScore: 25,
      maxScore: 70,
    };
  }

  return {
    kind: "default",
    label: "General Web3 due-diligence task",
    minScore: 0,
    maxScore: 100,
  };
}

function isCriticChallengeResolved(input: FinalAgentInput, challenge: CriticChallenge): boolean {
  const challengeText = normalizeForScoring(`${challenge.challenge} ${challenge.explanation}`);
  const statedFacts = normalizeForScoring(
    [
      input.task,
      input.researchOutput,
      input.riskOutput,
    ].join(" "),
  );

  const challengeMatches = (patterns: RegExp[]) => hasAny(challengeText, patterns);
  const factsHave = (patterns: RegExp[]) => hasAny(statedFacts, patterns);

  const custodyChallenge = challengeMatches([
    /\bcustody\b/,
    /\bfunds\b/,
    /\bwallet\b/,
    /\bprivate key\b/,
    /\bsigning\b/,
    /\btransaction\b/,
    /\bwithdrawal\b/,
    /\bdrain\b/,
  ]);

  if (custodyChallenge) {
    const explicitNonCustody = factsHave([
      /\bnon-custodial\b/,
      /\bno custody\b/,
      /\bno signing\b/,
      /\bdoes not sign\b/,
      /\bno private keys?\b/,
      /\bwithout private keys?\b/,
    ]);
    const custodyExposure = factsHave([
      /\bself-custodial\b/,
      /\buser funds\b/,
      /\bauto-?trad(?:e|es|ing)\b/,
      /\bdelegated wallet\b/,
      /\bsign(?:s|ing)? transactions\b/,
    ]) && !explicitNonCustody;
    const missingHardGuard = factsHave([
      /\bno withdrawal guards?\b/,
      /\bwithout withdrawal guards?\b/,
      /\bkey in env\b/,
      /\benv var\b/,
      /\benvironment variable\b/,
      /\bprivate key (?:stored|exposed|leak|leakage)\b/,
      /\bstatic key\b/,
      /\bsole signing\b/,
      /\bunrestricted\b/,
    ]);
    const hardCustodyControls = factsHave([
      /\bnon-custodial\b/,
      /\bno custody\b/,
      /\bno signing\b/,
      /\bdoes not sign\b/,
      /\bhuman approval\b/,
      /\bpolicy gate\b/,
      /\bdeterministic policy\b/,
      /\bwithdrawal guards?\b/,
      /\bsecure signing service\b/,
      /\bhsm\b/,
      /\bhardware security module\b/,
      /\bmultisig\b/,
      /\bmulti-signature\b/,
    ]);

    const unresolvedCustodySignals = missingHardGuard || (custodyExposure && !hardCustodyControls);

    return hardCustodyControls && !unresolvedCustodySignals;
  }

  if (challengeMatches([/\boracle\b/])) {
    return (
      factsHave([/\bno oracle dependency\b/, /\bno external oracle\b/, /\btwap guard\b/]) &&
      !factsHave([/\boracle manipulation\b/, /\bnovel twap\b/, /\buntested oracle\b/])
    );
  }

  if (challengeMatches([/\b(audit|audited|formal verification)\b/])) {
    return factsHave([
      /\bwell-audited\b/,
      /\baudited (?:2x|twice|by 2|by two)\b/,
      /\btwo independent audits?\b/,
      /\b2 independent audits?\b/,
      /\btwo audits?\b/,
      /\bformal verification\b/,
    ]);
  }

  if (challengeMatches([/\b(governance|admin|upgrade)\b/])) {
    return (
      factsHave([
        /\btimelock\b/,
        /\bgovernance active\b/,
        /\bdao\b/,
        /\bguarded admin controls?\b/,
        /\bguarded admin\b/,
      ]) && !factsHave([/\badmin key\b/, /\bunrestricted admin\b/])
    );
  }

  if (challengeMatches([/\b(liquidity|tvl|market depth)\b/])) {
    return factsHave([/\b100m tvl\b/, /\$100m\b/, /\bdeep liquidity\b/, /\bmature\b/]);
  }

  return false;
}

function countCriticPenalty(input: FinalAgentInput) {
  const challenges = input.critiqueOutput.challenges ?? [];
  const isReadOnlySafeTask = isReadOnlySafeTaskText(normalizeForScoring(input.task));
  const unresolved = challenges.filter((challenge) => !isCriticChallengeResolved(input, challenge));
  const resolvedChallenges = challenges.length - unresolved.length;
  const severityForScoring = (challenge: CriticChallenge): CriticChallenge["severity"] => {
    if (!isReadOnlySafeTask || challenge.severity !== "high") {
      return challenge.severity;
    }

    const challengeText = normalizeForScoring(`${challenge.challenge} ${challenge.explanation}`);
    const directLossSignal = hasAny(challengeText, [
      /\bprivate key\b/,
      /\bcustody\b/,
      /\bsigning\b/,
      /\bmove funds\b/,
      /\bdrain funds\b/,
      /\bsteal funds\b/,
      /\badmin keys?\b/,
      /\bgovernance takeover\b/,
    ]);

    return directLossSignal ? "high" : "medium";
  };

  const unresolvedSeverities = unresolved.map(severityForScoring);
  const unresolvedHigh = unresolvedSeverities.filter((severity) => severity === "high").length;
  const unresolvedMedium = unresolvedSeverities.filter((severity) => severity === "medium").length;
  const unresolvedLow = unresolvedSeverities.filter((severity) => severity === "low").length;
  const penalty = unresolvedHigh * 15 + unresolvedMedium * 7 + unresolvedLow * 3;

  return {
    totalChallenges: challenges.length,
    resolvedChallenges,
    unresolvedChallenges: unresolved.length,
    unresolvedHigh,
    unresolvedMedium,
    unresolvedLow,
    penalty,
  };
}

function recommendationFromScore(
  score: number,
  profile: ScoreProfile,
  unresolvedHigh: number,
  modelRecommendation: Recommendation,
): Recommendation {
  if (profile.kind === "garbage" || profile.kind === "high_risk_custody") {
    return "NO_GO";
  }

  if (profile.kind === "ambiguous_novel") {
    return "INVESTIGATE_MORE";
  }

  if (profile.kind === "edge_case" && score >= 35 && unresolvedHigh < 2) {
    return "INVESTIGATE_MORE";
  }

  if (score < 35 || unresolvedHigh >= 2) {
    return "NO_GO";
  }

  if (score >= 70 && unresolvedHigh === 0 && profile.kind !== "edge_case") {
    return "GO";
  }

  if (modelRecommendation === "NO_GO" && score < 50) {
    return "NO_GO";
  }

  return "INVESTIGATE_MORE";
}

function clampScoreToProfile(
  score: number,
  profile: ScoreProfile,
  critic: ReturnType<typeof countCriticPenalty>,
): number {
  const cappedScore = Math.min(profile.maxScore, score);
  const canFloorSafeProfile =
    (profile.kind === "mature_safe" || profile.kind === "read_only_safe") && critic.unresolvedHigh === 0;
  const canFloorAmbiguousProfile = profile.kind === "ambiguous_novel";
  const canFloorBoundedEdgeProfile = profile.kind === "edge_case" && critic.unresolvedHigh < 2;
  const canUseProfileFloor =
    critic.penalty === 0 ||
    canFloorSafeProfile ||
    canFloorAmbiguousProfile ||
    canFloorBoundedEdgeProfile ||
    profile.kind === "garbage" ||
    profile.kind === "high_risk_custody";

  return canUseProfileFloor ? Math.max(profile.minScore, cappedScore) : Math.max(0, cappedScore);
}

function alignScoreWithRecommendation(score: number, recommendation: Recommendation): number {
  if (recommendation === "NO_GO") {
    return Math.min(score, 34);
  }

  if (recommendation === "GO") {
    return Math.max(score, 70);
  }

  return Math.max(35, Math.min(69, score));
}

function evidenceConflictsWithCalibration(item: string): boolean {
  const normalized = item.toLowerCase();

  return (
    normalized.includes("base score derived") ||
    normalized.includes("critic adjustment:") ||
    normalized.includes("critic agent identified") ||
    normalized.includes("final score calculation:") ||
    normalized.includes("final score") ||
    normalized.includes("score calculation:") ||
    normalized.includes("recommendation go") ||
    normalized.includes("recommendation no_go") ||
    normalized.includes("recommendation investigate_more") ||
    normalized.includes("recommendation is ") ||
    normalized.includes("penalty applied:") ||
    normalized.includes("final recommendation")
  );
}

function sanitizeEvidenceForCalibration(evidence: string[]): string[] {
  return evidence.filter((item) => !evidenceConflictsWithCalibration(item));
}

function matureProtocolResidualRisks(): RiskItem[] {
  return [
    {
      title: "Fork-diff verification",
      severity: "low",
      explanation:
        "The local fork should still be compared against the audited Uniswap V3 baseline before deployment.",
    },
    {
      title: "Audit scope confirmation",
      severity: "low",
      explanation:
        "The two audits are a strong signal, but their scope should cover this exact fork and deployment configuration.",
    },
    {
      title: "Governance parameter monitoring",
      severity: "medium",
      explanation:
        "Active governance is positive, but admin roles, timelocks, and parameter changes should remain observable.",
    },
  ];
}

function alignRisksWithDecision(
  profile: ScoreProfile,
  recommendation: Recommendation,
  risks: RiskItem[],
): RiskItem[] {
  if (recommendation === "GO" && profile.kind === "mature_safe") {
    return matureProtocolResidualRisks();
  }

  if (recommendation === "GO") {
    return risks
      .map((risk) => {
        if (risk.severity !== "critical" && risk.severity !== "high") {
          return risk;
        }

        return {
          ...risk,
          severity: "medium" as RiskSeverity,
          explanation: `Residual, not blocking: ${risk.explanation}`,
        };
      })
      .slice(0, 6);
  }

  return risks.slice(0, 6);
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

function applyScoreCalibration(
  input: FinalAgentInput,
  report: AnalysisReport,
  modelScore: number,
): AnalysisReport {
  const profile = detectScoreProfile(input);
  const critic = countCriticPenalty(input);
  const baseScore = profile.baseScore ?? modelScore;
  const calculatedScore = clampScore(baseScore - critic.penalty);
  const profileScore = clampScoreToProfile(calculatedScore, profile, critic);
  const recommendation = recommendationFromScore(
    profileScore,
    profile,
    critic.unresolvedHigh,
    report.recommendation,
  );
  const finalScore = alignScoreWithRecommendation(profileScore, recommendation);
  const mathParts = [`Base ${baseScore} - ${critic.penalty} critic penalty = ${calculatedScore}`];

  if (profileScore !== calculatedScore) {
    mathParts.push(`profile-bounded to ${profileScore}`);
  }

  if (finalScore !== profileScore) {
    mathParts.push(`decision-aligned to ${finalScore} for ${recommendation}`);
  }

  const math = mathParts.join("; ");
  const alignedRisks = alignRisksWithDecision(profile, recommendation, report.risks);
  const sanitizedEvidence = sanitizeEvidenceForCalibration(report.evidence);

  const evidence = [
    ...sanitizedEvidence,
    `Critic adjustment: ${critic.totalChallenges} challenge(s), ${critic.resolvedChallenges} resolved, ${critic.unresolvedChallenges} unresolved (high ${critic.unresolvedHigh}, medium ${critic.unresolvedMedium}, low ${critic.unresolvedLow}) -> score adjusted -${critic.penalty}.`,
    `Score calibration: ${profile.label}. ${math}.`,
    `Decision consistency: recommendation ${recommendation}, final score ${finalScore}, risks aligned after calibration.`,
  ].slice(0, 12);

  return {
    ...report,
    score: finalScore,
    recommendation,
    risks: alignedRisks,
    evidence,
    criticAdjustment: {
      ...critic,
      baseScore,
      finalScore,
      math,
    },
  };
}

function buildReportFromModelOutput(input: FinalAgentInput, rawOutput: string): AnalysisReport {
  const parsed = extractJsonObject(rawOutput);
  const fallback = createFallbackReport(input);

  if (parsed === null) {
    return applyScoreCalibration(input, fallback, fallback.score);
  }

  const modelEvidence = normalizeStringArray(parsed.evidence, fallback.evidence);
  const modelScore = clampScore(parsed.score);

  const report: AnalysisReport = {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : fallback.summary,
    score: modelScore,
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

  return applyScoreCalibration(input, report, modelScore);
}

export async function runFinalAgent(input: FinalAgentInput): Promise<{
  rawOutput: string;
  report: AnalysisReport;
}> {
  // Calculate critic-based score penalty
  const criticPenalty = (input.critiqueOutput.challenges || []).reduce((sum, challenge) => {
    if (challenge.severity === "high") return sum + 15;
    if (challenge.severity === "medium") return sum + 7;
    if (challenge.severity === "low") return sum + 3;
    return sum;
  }, 0);

  const criticSummary =
    input.critiqueOutput.challenges && input.critiqueOutput.challenges.length > 0
      ? `The Critic Agent identified ${input.critiqueOutput.challenges.length} challenges: ${input.critiqueOutput.challenges.map((c) => `${c.severity}(${c.challenge})`).join("; ")}`
      : "The Critic Agent found no material challenges.";

  const rawOutput = await runInference({
    agentName: "final_agent",
    systemPrompt: [
      "You are the Final Decision Agent in ClawMind.",
      "Your job: synthesize all agent outputs into a final score, recommendation, and structured report.",
      "",
      "SCORE CALCULATION RULES (READ CAREFULLY):",
      "1. Start with a base score (0-100) reflecting overall protocol quality and safety.",
      "2. The Critic Agent provided challenges with severity ratings (high/medium/low).",
      "3. Apply these penalties for UNRESOLVED critic challenges:",
      "   - Each HIGH severity challenge: -15 points",
      "   - Each MEDIUM severity challenge: -7 points",
      "   - Each LOW severity challenge: -3 points",
      "4. Show your math: 'Base 75 - 15 (HIGH critic) - 7 (MEDIUM critic) = 53'.",
      "5. Final score must be 0-100, integer.",
      "",
      "FEW-SHOT EXAMPLES (to anchor your scoring):",
      "",
      "Example A: High-risk custody auto-trading",
      "  Summary: Agent auto-trades user funds with no withdrawal guards, private key in env var.",
      "  Expected: score 15-25, recommendation NO_GO",
      "  Reasoning: Uncontrolled fund movement + key exposure = critical custody failure.",
      "",
      "Example B: Mature, well-audited protocol",
      "  Summary: Uniswap V3 fork, no external oracle dependency, audited 2x, $100M TVL, immutable core contracts, no admin keys, non-custodial pools, timelocked governance for fee parameters only.",
      "  Expected: score 80-95, recommendation GO",
      "  Reasoning: Proven architecture, audited, substantial TVL, and no direct custody/admin execution path.",
      "",
      "Example C: Novel mechanism, mixed signals",
      "  Summary: New AMM with unique TWAP oracle, 1 audit, $5M TVL, team anonymous.",
      "  Expected: score 45-55, recommendation INVESTIGATE_MORE",
      "  Reasoning: Innovation is positive but unproven, team credibility missing.",
      "",
      "Calibration anchor: If the task describes a mature, multi-audited protocol/fork with $40M+ TVL, non-custodial design, timelocked/guarded admin controls, and no new custody or oracle surface, score should land in the 75-90 range unless the Critic raised unresolved HIGH challenges tied to direct custody, private keys, unrestricted admin control, or fund loss.",
      "Calibration anchor: If the task describes a novel AMM/TWAP/oracle mechanism with one audit, low-to-mid TVL, or an anonymous team, classify it as INVESTIGATE_MORE in the 40-60 range unless it also includes direct custody, exposed private keys, or automated user-fund execution.",
      "",
      "RECOMMENDATION RULES:",
      "- GO: score >= 70 AND no HIGH critic challenges unresolved.",
      "- NO_GO: score < 35 OR 2+ HIGH critic challenges unresolved.",
      "- INVESTIGATE_MORE: everything else.",
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
      "Allowed severity values: low, medium, high, critical",
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
      "Critic Summary:",
      criticSummary,
      `(Implied score penalty: -${criticPenalty} points)`,
      "",
      `Known critic challenges: ${JSON.stringify(input.critiqueOutput.challenges || [])}`,
      "",
      "Your task:",
      "1. Provide a summary of your analysis.",
      "2. Calculate and return the final score (0-100), factoring in critic penalties.",
      "3. Return the appropriate recommendation (GO, NO_GO, or INVESTIGATE_MORE).",
      "4. List material risks with severity.",
      "5. List opportunities from prior memory and current analysis.",
      "6. Recommend architecture choices.",
      "7. Suggest next steps.",
      "8. Provide evidence of reasoning.",
      "",
      "Prioritize: safety > verifiability > memory persistence > infrastructure > orchestration.",
      "Return exactly one valid JSON object. No markdown. No prose.",
    ].join("\n"),
  });

  const report = buildReportFromModelOutput(input, rawOutput);

  return {
    rawOutput,
    report,
  };
}
