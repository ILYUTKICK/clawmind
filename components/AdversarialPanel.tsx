"use client";

import { AgentStep, AnalysisReport } from "@/lib/types";
import type { CriticOutput } from "@/lib/agents/critic";

type AdversarialPanelProps = {
  steps: AgentStep[];
  report?: AnalysisReport;
};

type ChallengeSeverity = "high" | "medium" | "low";
type ChallengeStatus = "resolved" | "unresolved" | "pending";

type ChallengeRow = {
  id: string;
  agentName: AgentStep["name"];
  agentLabel: string;
  severity: ChallengeSeverity;
  summary: string;
  explanation: string;
  status: ChallengeStatus;
};

const CHALLENGED_AGENTS: {
  name: AgentStep["name"];
  label: string;
  token: string;
}[] = [
  { name: "planner", label: "Planner", token: "PL" },
  { name: "researcher", label: "Researcher", token: "RS" },
  { name: "risk_agent", label: "Risk Agent", token: "RK" },
  { name: "architect", label: "Architect", token: "AR" },
];

const AGENT_CLAIMS: {
  name: AgentStep["name"];
  label: string;
  token: string;
}[] = [
  { name: "memory_retrieval", label: "Memory Retrieval", token: "MR" },
  { name: "planner", label: "Planner", token: "PL" },
  { name: "researcher", label: "Researcher", token: "RS" },
  { name: "risk_agent", label: "Risk Agent", token: "RK" },
  { name: "architect", label: "Architect", token: "AR" },
  { name: "critic", label: "Critic", token: "CR" },
  { name: "final_agent", label: "Final Agent", token: "FN" },
  { name: "report_storage", label: "Report Storage", token: "ST" },
  { name: "memory_index", label: "Memory Index", token: "MI" },
  { name: "onchain_registry", label: "On-chain Registry", token: "OC" },
];

const SEVERITY_META: Record<
  ChallengeSeverity,
  { label: string; penalty: number; className: string; title: string }
> = {
  high: {
    label: "High",
    penalty: 15,
    className: "border-[var(--cm-critical)]/40 bg-[var(--cm-critical)]/10 text-red-200",
    title: "HIGH unresolved challenge lowers the final score by 15 points.",
  },
  medium: {
    label: "Medium",
    penalty: 7,
    className: "border-[var(--cm-warning)]/40 bg-[var(--cm-warning)]/10 text-amber-200",
    title: "MEDIUM unresolved challenge lowers the final score by 7 points.",
  },
  low: {
    label: "Low",
    penalty: 3,
    className: "border-[var(--cm-border)] bg-white/[0.03] text-zinc-300",
    title: "LOW unresolved challenge lowers the final score by 3 points.",
  },
};

function truncate(text: string, maxLen: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLen) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLen).trimEnd()}...`;
}

function normalizeSeverity(value: unknown): ChallengeSeverity {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return "medium";
}

function extractClaim(text: string | undefined, maxLen = 190): string {
  if (!text) {
    return "Waiting for analysis.";
  }

  const cleaned = text.replace(/\n+/g, " ").trim();
  const firstPeriod = cleaned.indexOf(". ");

  if (firstPeriod > 0 && firstPeriod < maxLen) {
    return cleaned.slice(0, firstPeriod + 1);
  }

  return truncate(cleaned, maxLen);
}

function tryParseCriticOutput(criticOutput: string | undefined): CriticOutput | null {
  if (!criticOutput) {
    return null;
  }

  try {
    const parsed = JSON.parse(criticOutput) as Partial<CriticOutput>;

    if (!Array.isArray(parsed.challenges)) {
      return null;
    }

    return {
      challenges: parsed.challenges
        .filter((challenge) => typeof challenge?.challenge === "string")
        .map((challenge) => ({
          challenge: challenge.challenge,
          severity: normalizeSeverity(challenge.severity),
          explanation:
            typeof challenge.explanation === "string"
              ? challenge.explanation
              : "The critic flagged this issue for final-agent reconciliation.",
        })),
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "Critic found material challenges.",
    };
  } catch {
    return null;
  }
}

function matchAgentIndex(challengeText: string, used: Set<number>): number {
  const lower = challengeText.toLowerCase();
  const directMatch = CHALLENGED_AGENTS.findIndex((agent) =>
    lower.includes(agent.label.toLowerCase()) || lower.includes(agent.name.replace("_", " ")),
  );

  if (directMatch >= 0 && !used.has(directMatch)) {
    return directMatch;
  }

  const available = CHALLENGED_AGENTS.findIndex((_, index) => !used.has(index));
  return available >= 0 ? available : 0;
}

function buildChallengeRows(
  criticOutput: string | undefined,
  criticAdjustment: AnalysisReport["criticAdjustment"],
  finalCompleted: boolean,
): ChallengeRow[] {
  const parsed = tryParseCriticOutput(criticOutput);

  if (!parsed || parsed.challenges.length === 0) {
    return [];
  }

  const unresolvedBudget: Record<ChallengeSeverity, number> = {
    high: criticAdjustment?.unresolvedHigh ?? 0,
    medium: criticAdjustment?.unresolvedMedium ?? 0,
    low: criticAdjustment?.unresolvedLow ?? 0,
  };
  const usedAgents = new Set<number>();

  return parsed.challenges.map((challenge, index) => {
    const severity = normalizeSeverity(challenge.severity);
    const agentIndex = matchAgentIndex(challenge.challenge, usedAgents);
    const agent = CHALLENGED_AGENTS[agentIndex] ?? CHALLENGED_AGENTS[0];

    usedAgents.add(agentIndex);

    let status: ChallengeStatus = "pending";

    if (finalCompleted) {
      const isUnresolved = unresolvedBudget[severity] > 0;
      status = isUnresolved ? "unresolved" : "resolved";

      if (isUnresolved) {
        unresolvedBudget[severity] -= 1;
      }
    }

    return {
      id: `${agent.name}-${index}`,
      agentName: agent.name,
      agentLabel: agent.label,
      severity,
      summary: truncate(challenge.challenge, 180),
      explanation: truncate(challenge.explanation, 220),
      status,
    };
  });
}

function extractPerAgentResolution(
  finalOutput: string | undefined,
  agentName: AgentStep["name"],
  challenge?: ChallengeRow,
  agentClaim?: string,
): string {
  if (!finalOutput) {
    return "Final synthesis has not completed yet.";
  }

  const label = CHALLENGED_AGENTS.find((agent) => agent.name === agentName)?.label ?? agentName;
  const patterns = [
    new RegExp(`\\*\\*${label}[:\\s]*\\*\\*[:\\s]*(.*?)(?=\\*\\*(?:Planner|Researcher|Risk Agent|Architect)\\s*\\*\\*|$)`, "is"),
    new RegExp(`#{1,3}\\s*${label}[:\\s]*(.*?)(?=#{1,3}\\s*(?:Planner|Researcher|Risk Agent|Architect)|$)`, "is"),
    new RegExp(`${label}[:\\s-]+(.*?)(?=(?:Planner|Researcher|Risk Agent|Architect)[:\\s-]|$)`, "is"),
  ];

  for (const pattern of patterns) {
    const match = finalOutput.match(pattern);

    if (match?.[1] && match[1].trim().length > 10) {
      return truncate(match[1], 190);
    }
  }

  if (challenge) {
    const claim = agentClaim && !agentClaim.startsWith("Waiting for analysis.")
      ? ` Agent claim: ${extractClaim(agentClaim, 110)}`
      : "";
    const prefix = challenge.status === "resolved"
      ? "Final Agent marked this challenge resolved"
      : "Final Agent left this challenge unresolved";

    return truncate(`${prefix}: ${challenge.explanation || challenge.summary}.${claim}`, 190);
  }

  return truncate(extractClaim(agentClaim) || finalOutput, 190);
}

function recommendationClass(recommendation: AnalysisReport["recommendation"] | undefined): string {
  if (recommendation === "GO") {
    return "border-[var(--cm-accent)]/40 bg-[var(--cm-accent)]/10 text-teal-200";
  }

  if (recommendation === "NO_GO") {
    return "border-[var(--cm-critical)]/40 bg-[var(--cm-critical)]/10 text-red-200";
  }

  return "border-[var(--cm-warning)]/40 bg-[var(--cm-warning)]/10 text-amber-200";
}

function statusClass(status: ChallengeStatus): string {
  if (status === "resolved") {
    return "border-[var(--cm-accent)]/40 bg-[var(--cm-accent)]/10 text-teal-200";
  }

  if (status === "unresolved") {
    return "border-[var(--cm-critical)]/40 bg-[var(--cm-critical)]/10 text-red-200";
  }

  return "border-[var(--cm-border)] bg-white/[0.03] text-[var(--cm-text-muted)]";
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "accent" | "critical" | "warning";
}) {
  const toneClass = {
    neutral: "text-[var(--cm-text-primary)]",
    accent: "text-[var(--cm-accent)]",
    critical: "text-[var(--cm-critical)]",
    warning: "text-[var(--cm-warning)]",
  }[tone];

  return (
    <div className="rounded-lg border border-[var(--cm-border)] bg-black/20 p-3">
      <p className="text-[11px] uppercase text-[var(--cm-text-muted)]">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: ChallengeSeverity }) {
  const meta = SEVERITY_META[severity];

  return (
    <span
      title={meta.title}
      className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ChallengeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}

function ScoreMath({
  report,
  challengeRows,
}: {
  report?: AnalysisReport;
  challengeRows: ChallengeRow[];
}) {
  const adjustment = report?.criticAdjustment;
  const highPenalty = (adjustment?.unresolvedHigh ?? 0) * SEVERITY_META.high.penalty;
  const mediumPenalty = (adjustment?.unresolvedMedium ?? 0) * SEVERITY_META.medium.penalty;
  const lowPenalty = (adjustment?.unresolvedLow ?? 0) * SEVERITY_META.low.penalty;
  const baseScore = adjustment?.baseScore ?? report?.score ?? 0;
  const finalScore = adjustment?.finalScore ?? report?.score ?? 0;
  const recommendation = report?.recommendation ?? "INVESTIGATE_MORE";

  return (
    <div className="rounded-lg border border-[var(--cm-border)] bg-[#0d0d0f] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--cm-text-primary)]">Score adjustment</p>
        <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${recommendationClass(recommendation)}`}>
          {recommendation}
        </span>
      </div>
      <pre className="overflow-x-auto whitespace-pre text-xs leading-6 text-zinc-300 [font-family:var(--cm-font-mono)]">
{`Initial score:       ${String(baseScore).padStart(3, " ")}
High severity:      -${String(highPenalty).padStart(2, " ")}
Medium severity:    -${String(mediumPenalty).padStart(2, " ")}
Low severity:       -${String(lowPenalty).padStart(2, " ")}
Final score:         ${String(finalScore).padStart(3, " ")} -> ${recommendation}`}
      </pre>
      {adjustment?.math ? (
        <p className="mt-3 border-t border-[var(--cm-border)] pt-3 font-mono text-[11px] leading-5 text-[var(--cm-text-muted)]">
          {adjustment.math}
        </p>
      ) : challengeRows.length > 0 ? (
        <p className="mt-3 border-t border-[var(--cm-border)] pt-3 text-xs text-[var(--cm-text-muted)]">
          Waiting for the Final Agent to publish score math.
        </p>
      ) : null}
    </div>
  );
}

export function AdversarialPanel({ steps, report }: AdversarialPanelProps) {
  const stepMap = new Map(steps.map((step) => [step.name, step]));
  const criticStep = stepMap.get("critic");
  const finalStep = stepMap.get("final_agent");
  const hasAnalysis = steps.length > 0;
  const criticCompleted = criticStep?.status === "completed";
  const finalCompleted = finalStep?.status === "completed";
  const criticAdjustment = report?.criticAdjustment;
  const challengeRows = buildChallengeRows(criticStep?.output, criticAdjustment, finalCompleted);
  const totalChallengeCount = criticAdjustment?.totalChallenges ?? challengeRows.length;
  const resolvedCount =
    finalCompleted
      ? criticAdjustment?.resolvedChallenges ?? challengeRows.filter((row) => row.status === "resolved").length
      : 0;
  const unresolvedCount =
    criticAdjustment?.unresolvedChallenges ??
    (finalCompleted ? challengeRows.filter((row) => row.status === "unresolved").length : totalChallengeCount);
  const scorePenalty = criticAdjustment?.penalty ?? 0;
  const criticalOpen = (criticAdjustment?.unresolvedHigh ?? 0) > 0 || challengeRows.some((row) => row.status === "unresolved" && row.severity === "high");
  const headerTone = criticalOpen ? "text-[var(--cm-critical)]" : totalChallengeCount > 0 ? "text-[var(--cm-warning)]" : "text-[var(--cm-accent)]";

  if (!hasAnalysis) {
    return (
      <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase text-[var(--cm-text-muted)]">Adversarial Review</p>
          <h2 className="text-2xl font-semibold text-[var(--cm-text-primary)]">
            Critic raised 0 challenges
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--cm-text-muted)]">
            Run an analysis to see critic challenges, final-agent resolutions, and score adjustment math.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {AGENT_CLAIMS.map((agent) => (
            <div key={agent.name} className="rounded-lg border border-[var(--cm-border)] bg-black/20 p-4 opacity-60">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cm-border)] font-mono text-xs text-[var(--cm-text-muted)]">
                {agent.token}
              </span>
              <p className="mt-3 text-sm font-semibold text-zinc-300">{agent.label}</p>
              <p className="mt-1 text-xs text-[var(--cm-text-muted)]">Waiting for claim.</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase text-[var(--cm-text-muted)]">Adversarial Review</p>
          <h2 className={`mt-2 text-2xl font-semibold ${headerTone}`}>
            Critic raised {totalChallengeCount} challenge{totalChallengeCount === 1 ? "" : "s"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cm-text-muted)]">
            {finalCompleted
              ? `${resolvedCount} resolved by Final Agent, ${unresolvedCount} unresolved -> score adjusted -${scorePenalty}.`
              : criticCompleted
                ? "Final Agent is reconciling critic challenges before publishing the final score."
                : "Critic Agent is still evaluating assumptions from Planner, Researcher, Risk Agent, and Architect."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <Metric label="resolved" value={resolvedCount} tone="accent" />
          <Metric label="unresolved" value={unresolvedCount} tone={unresolvedCount > 0 ? "critical" : "neutral"} />
          <Metric label="penalty" value={`-${scorePenalty}`} tone={scorePenalty > 0 ? "warning" : "neutral"} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div id="critic-challenges" className="scroll-mt-24 rounded-lg border border-[var(--cm-border)] bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--cm-text-primary)]">Critic challenges</h3>
              {criticStep?.status === "running" ? (
                <span className="rounded-md border border-[var(--cm-accent)]/30 bg-[var(--cm-accent)]/10 px-2 py-1 text-[11px] font-semibold text-teal-200">
                  running
                </span>
              ) : null}
            </div>

            {challengeRows.length > 0 ? (
              <div className="space-y-3">
                {challengeRows.map((challenge) => (
                  <article key={challenge.id} className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={challenge.severity} />
                      <StatusBadge status={challenge.status} />
                      <span className="rounded-md border border-[var(--cm-border)] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-[var(--cm-text-muted)]">
                        vs {challenge.agentLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[var(--cm-text-primary)]">
                      {challenge.summary}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--cm-text-muted)]">
                      {challenge.explanation}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4 text-sm text-[var(--cm-text-muted)]">
                {criticCompleted ? "Critic found no material challenges." : "Waiting for critic output."}
              </div>
            )}
          </div>

          <details className="group rounded-lg border border-[var(--cm-border)] bg-black/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-[var(--cm-text-primary)]">Full agent trace</span>
              <span className="font-mono text-xs text-[var(--cm-text-muted)] group-open:hidden">{steps.length} steps</span>
              <span className="hidden font-mono text-xs text-[var(--cm-text-muted)] group-open:inline">hide</span>
            </summary>
            <div className="grid gap-3 border-t border-[var(--cm-border)] p-4 md:grid-cols-2">
              {AGENT_CLAIMS.map((agent) => {
                const step = stepMap.get(agent.name);
                const inactive = !step || step.status === "pending";
                const isCritic = agent.name === "critic";

                return (
                  <div
                    id={`agent-claim-${agent.name}`}
                    key={agent.name}
                    className={`scroll-mt-24 rounded-lg border bg-[var(--cm-background)] p-4 ${isCritic ? "border-[var(--cm-warning)]/45" : "border-[var(--cm-border)]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-xs ${isCritic ? "border-[var(--cm-warning)]/50 text-amber-200" : "border-[var(--cm-border)] text-[var(--cm-text-muted)]"}`}>
                        {agent.token}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${isCritic ? "text-amber-100" : "text-[var(--cm-text-primary)]"}`}>{agent.label}</p>
                        <p className="text-[11px] text-[var(--cm-text-muted)]">{step?.status ?? "pending"}</p>
                      </div>
                    </div>
                    <p className={`mt-3 text-xs leading-5 ${inactive ? "text-zinc-600" : "text-zinc-300"}`}>
                      {extractClaim(step?.output)}
                    </p>
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        <div className="space-y-4">
          <ScoreMath report={report} challengeRows={challengeRows} />

          <div id="final-reconciliation" className="scroll-mt-24 rounded-lg border border-[var(--cm-border)] bg-black/20 p-4">
            <h3 className="text-sm font-semibold text-[var(--cm-text-primary)]">Final Agent reconciliation</h3>
            {finalCompleted ? (
              <div className="mt-4 space-y-3">
                {(challengeRows.length > 0 ? challengeRows : CHALLENGED_AGENTS.map((agent, index) => ({
                  id: `${agent.name}-${index}`,
                  agentName: agent.name,
                  agentLabel: agent.label,
                  severity: "low" as ChallengeSeverity,
                  summary: "No critic challenge for this agent.",
                  explanation: "",
                  status: "resolved" as ChallengeStatus,
                }))).map((challenge) => {
                  const agentClaim = stepMap.get(challenge.agentName)?.output;

                  return (
                    <div key={challenge.id} className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-zinc-300">{challenge.agentLabel}</p>
                        <StatusBadge status={challenge.status} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--cm-text-muted)]">
                        {extractPerAgentResolution(finalStep?.output, challenge.agentName, challenge, agentClaim)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--cm-text-muted)]">
                Reconciliation will appear once the Final Agent completes synthesis.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
