"use client";

import { AgentStep, AnalysisReport } from "@/lib/types";
import type { CriticOutput } from "@/lib/agents/critic";

type AdversarialPanelProps = {
  steps: AgentStep[];
  report?: AnalysisReport;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CHALLENGED_AGENTS: {
  name: AgentStep["name"];
  icon: string;
  label: string;
  accentBorder: string;
  accentText: string;
  accentBg: string;
}[] = [
  {
    name: "planner",
    icon: "📋",
    label: "Planner",
    accentBorder: "border-purple-400/30",
    accentText: "text-purple-300",
    accentBg: "bg-purple-400/10",
  },
  {
    name: "researcher",
    icon: "🔍",
    label: "Researcher",
    accentBorder: "border-blue-400/30",
    accentText: "text-blue-300",
    accentBg: "bg-blue-400/10",
  },
  {
    name: "risk_agent",
    icon: "⚡",
    label: "Risk Agent",
    accentBorder: "border-amber-400/30",
    accentText: "text-amber-300",
    accentBg: "bg-amber-400/10",
  },
  {
    name: "architect",
    icon: "🏗️",
    label: "Architect",
    accentBorder: "border-emerald-400/30",
    accentText: "text-emerald-300",
    accentBg: "bg-emerald-400/10",
  },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Extract the first 1–2 sentences as a "key claim" summary. */
function extractClaim(text: string, maxLen = 180): string {
  if (!text) return "No claim produced";
  const cleaned = text.replace(/\n+/g, " ").trim();
  // Try to grab the first meaningful sentence (up to maxLen)
  const firstPeriod = cleaned.indexOf(". ");
  if (firstPeriod > 0 && firstPeriod < maxLen) {
    return cleaned.slice(0, firstPeriod + 1);
  }
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).trimEnd() + "…";
}

/**
 * Parse the critic output into per-agent challenges.
 * Now handles both structured JSON (new format) and legacy text format.
 */
function extractChallenges(
  criticOutput: string | undefined,
  agentNames: string[]
): Map<string, string> {
  const challenges = new Map<string, string>();

  if (!criticOutput) return challenges;

  // Try to parse as structured JSON first (new format)
  try {
    const parsed = JSON.parse(criticOutput) as CriticOutput;
    if (parsed.challenges && Array.isArray(parsed.challenges)) {
      // Map challenges to agents based on challenge content
      for (const challenge of parsed.challenges) {
        // Try to match challenge to an agent based on keywords in the challenge text
        let matchedAgent = null;
        const challengeText = challenge.challenge.toLowerCase();

        for (const agentName of agentNames) {
          const agentLabel = CHALLENGED_AGENTS.find((a) => a.name === agentName)?.label.toLowerCase();
          if (agentLabel && challengeText.includes(agentLabel)) {
            matchedAgent = agentName;
            break;
          }
        }

        // If no specific agent matched, assign to the first agent that doesn't have a challenge yet
        if (!matchedAgent) {
          for (const agentName of agentNames) {
            if (!challenges.has(agentName)) {
              matchedAgent = agentName;
              break;
            }
          }
        }

        // If we found an agent to assign to, add the challenge
        if (matchedAgent) {
          const displayText = `${challenge.challenge} (${challenge.severity} severity)`;
          challenges.set(matchedAgent, displayText.length > 220 ? displayText.slice(0, 220).trimEnd() + "…" : displayText);
        }
      }
      return challenges;
    }
  } catch {
    // Not JSON, fall back to legacy text parsing
  }

  // Legacy text parsing (fallback for old format)
  // Build a list of label variants for matching
  const agentLabels = agentNames.map((name) => {
    const label = CHALLENGED_AGENTS.find((a) => a.name === name)?.label ?? name;
    return { name, label, variants: [label, name] };
  });

  // Strategy 1: Try to find sections delimited by agent names
  // Works with formats like:
  //   "**Planner**: ..." or "### Planner" or "1. Planner:" or "Planner - ..."
  for (const { name, label } of agentLabels) {
    // Try multiple regex patterns to find the section for this agent
    const patterns = [
      // **Planner** or **Planner:** or **Planner**:
      new RegExp(`\\*\\*${label}[:\\s]*\\*\\*[:\\s]*(.*?)(?=\\*\\*(?:Planner|Researcher|Risk Agent|Risk|Architect)\\s*\\*\\*|$)`, "is"),
      // ### Planner or ## Planner
      new RegExp(`#{1,3}\\s*${label}[:\\s]*(.*?)(?=#{1,3}\\s*(?:Planner|Researcher|Risk Agent|Risk|Architect)|$)`, "is"),
      // Planner: or Planner -
      new RegExp(`(?:^|\\n)\\s*${label}[:\\s-]+(.*?)(?=(?:^|\\n)\\s*(?:Planner|Researcher|Risk Agent|Risk|Architect)[:\\s-]|$)`, "is"),
      // Numbered list: 1. **Planner**: or 1. Planner:
      new RegExp(`\\d+\\.\\s*\\*{0,2}${label}\\*{0,2}[:\\s]*(.*?)(?=\\d+\\.\\s*\\*{0,2}(?:Planner|Researcher|Risk Agent|Risk|Architect)|$)`, "is"),
      // "Critique of Planner:" or "vs Planner:"
      new RegExp(`(?:Critique|Review|Challenge|vs)[\\s]+(?:of|on|against)?[\\s]*${label}[:\\s]*(.*?)(?=(?:Critique|Review|Challenge|vs)[\\s]+(?:of|on|against)?[\\s]*(?:Planner|Researcher|Risk Agent|Risk|Architect)|$)`, "is"),
    ];

    for (const pat of patterns) {
      const m = criticOutput.match(pat);
      if (m && m[1] && m[1].trim().length > 10) {
        const text = m[1].trim();
        challenges.set(name, text.length > 220 ? text.slice(0, 220).trimEnd() + "…" : text);
        break;
      }
    }
  }

  // Strategy 2: If some agents were found but not all, try splitting by numbered sections
  if (challenges.size > 0 && challenges.size < agentLabels.length) {
    // Already partially found — leave as is
  } else if (challenges.size === 0) {
    // Strategy 3: Split the whole output into chunks and assign to agents
    const lines = criticOutput.split(/\n+/).filter((l) => l.trim().length > 5);

    if (lines.length >= agentLabels.length) {
      // Try to match each line to an agent by looking for agent names
      for (const { name, label } of agentLabels) {
        for (const line of lines) {
          if (
            line.toLowerCase().includes(label.toLowerCase()) &&
            !challenges.has(name)
          ) {
            const text = line.replace(/^[*\d.\-#\s]+/, "").trim();
            if (text.length > 10) {
              challenges.set(name, text.length > 220 ? text.slice(0, 220).trimEnd() + "…" : text);
              break;
            }
          }
        }
      }
    }

    // Strategy 4: If still nothing, distribute the whole output as a general challenge
    if (challenges.size === 0) {
      const summary = extractClaim(criticOutput, 280);
      for (const name of agentNames) {
        challenges.set(name, summary);
      }
    }
  }

  return challenges;
}

/**
 * Parse the final_agent output for reconciliation/resolution text per agent.
 */
function extractPerAgentResolution(
  finalOutput: string | undefined,
  agentName: string
): string | null {
  if (!finalOutput) return null;
  const label = CHALLENGED_AGENTS.find((a) => a.name === agentName)?.label ?? agentName;

  // Try multiple patterns
  const patterns = [
    // **Planner** or **Planner:** followed by content
    new RegExp(`\\*\\*${label}[:\\s]*\\*\\*[:\\s]*(.*?)(?=\\*\\*(?:Planner|Researcher|Risk Agent|Risk|Architect)\\s*\\*\\*|$)`, "is"),
    // ### Planner or ## Planner
    new RegExp(`#{1,3}\\s*${label}[:\\s]*(.*?)(?=#{1,3}\\s*(?:Planner|Researcher|Risk Agent|Risk|Architect)|$)`, "is"),
    // Planner: or Planner -
    new RegExp(`${label}[:\\s-]+(.*?)(?=(?:Planner|Researcher|Risk Agent|Risk|Architect)[:\\s-]|$)`, "is"),
    // Numbered list: 1. **Planner**:
    new RegExp(`\\d+\\.\\s*\\*{0,2}${label}\\*{0,2}[:\\s]*(.*?)(?=\\d+\\.\\s*\\*{0,2}(?:Planner|Researcher|Risk Agent|Risk|Architect)|$)`, "is"),
    // "Reconciliation for Planner:" or "Resolution - Planner:"
    new RegExp(`(?:Reconciliation|Resolution|Addressed|Resolved)[\\s]+(?:for|on|against|with)?[\\s]*${label}[:\\s]*(.*?)(?=(?:Reconciliation|Resolution|Addressed|Resolved)[\\s]+(?:for|on|against|with)?[\\s]*(?:Planner|Researcher|Risk Agent|Risk|Architect)|$)`, "is"),
  ];

  for (const pat of patterns) {
    const m = finalOutput.match(pat);
    if (m && m[1] && m[1].trim().length > 10) {
      const text = m[1].trim();
      return text.length > 180 ? text.slice(0, 180).trimEnd() + "…" : text;
    }
  }

  return null;
}

/**
 * Extract a general resolution summary from the final agent output.
 */
function extractResolution(finalOutput: string | undefined): string {
  if (!finalOutput) return "Pending final synthesis";
  const cleaned = finalOutput.replace(/\n+/g, " ").trim();
  if (cleaned.length <= 300) return cleaned;
  return cleaned.slice(0, 300).trimEnd() + "…";
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function PlaceholderCard({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 opacity-40">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-sm font-semibold text-zinc-400">{label}</span>
      </div>
      <p className="text-xs text-zinc-600 italic">Waiting for analysis…</p>
    </div>
  );
}

function ClaimCard({
  icon,
  label,
  claim,
  accentBorder,
  accentText,
  accentBg,
}: {
  icon: string;
  label: string;
  claim: string;
  accentBorder: string;
  accentText: string;
  accentBg: string;
}) {
  return (
    <div
      className={`rounded-2xl border ${accentBorder} ${accentBg} p-4 transition-all duration-300 hover:border-opacity-60`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-base leading-none">{icon}</span>
        <span className={`text-sm font-bold ${accentText}`}>{label}</span>
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed">{claim}</p>
    </div>
  );
}

function ChallengeCard({
  agentLabel,
  challenge,
}: {
  agentLabel: string;
  challenge: string;
}) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-4 transition-all duration-300 hover:border-red-400/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base leading-none">🔎</span>
        <span className="text-sm font-bold text-red-200">Critic</span>
        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
          CHALLENGED
        </span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        <span className="text-zinc-500 font-medium">vs {agentLabel}:</span>{" "}
        {challenge}
      </p>
    </div>
  );
}

function ResolutionRow({
  agentLabel,
  agentIcon,
  resolution,
  accentBorder,
}: {
  agentLabel: string;
  agentIcon: string;
  resolution: string;
  accentBorder: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border ${accentBorder} bg-black/20 p-4`}
    >
      <span className="text-base leading-none mt-0.5">{agentIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold text-white">{agentLabel}</span>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            RESOLVED
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{resolution}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export function AdversarialPanel({ steps, report }: AdversarialPanelProps) {
  const stepMap = new Map(steps.map((s) => [s.name, s]));
  const criticStep = stepMap.get("critic");
  const finalStep = stepMap.get("final_agent");
  const hasAnalysis = steps.length > 0;
  const criticCompleted = criticStep?.status === "completed";
  const finalCompleted = finalStep?.status === "completed";
  const agentNames = CHALLENGED_AGENTS.map((a) => a.name);

  // Extract data from steps
  const challenges = extractChallenges(
    criticStep?.output,
    agentNames
  );

  const finalResolution = extractResolution(finalStep?.output);

  // Count challenged & resolved
  const challengedCount = criticCompleted
    ? CHALLENGED_AGENTS.filter((a) => challenges.has(a.name)).length
    : 0;
  const fallbackResolvedCount = finalCompleted
    ? CHALLENGED_AGENTS.filter(
        (a) => challenges.has(a.name)
      ).length
    : 0;
  const criticAdjustment = report?.criticAdjustment;
  const totalChallengeCount = criticAdjustment?.totalChallenges ?? challengedCount;
  const resolvedCount = finalCompleted
    ? criticAdjustment?.resolvedChallenges ?? fallbackResolvedCount
    : 0;
  const unresolvedCount = criticAdjustment?.unresolvedChallenges ?? Math.max(0, totalChallengeCount - resolvedCount);
  const scorePenalty = criticAdjustment?.penalty ?? 0;

  /* ---------------------------------------------------------------------- */
  /*  Empty / placeholder state                                              */
  /* ---------------------------------------------------------------------- */

  if (!hasAnalysis) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">Adversarial Review</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Critic Agent challenges assumptions from Planner, Researcher, Risk,
            and Architect agents
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Agent Claims placeholders */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Agent Claims
            </h3>
            <div className="space-y-3">
              {CHALLENGED_AGENTS.map((a) => (
                <PlaceholderCard key={a.name} label={a.label} icon={a.icon} />
              ))}
            </div>
          </div>

          {/* Right: Critic Challenges placeholders */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Critic Challenges
            </h3>
            <div className="space-y-3">
              {CHALLENGED_AGENTS.map((a) => (
                <PlaceholderCard key={a.name} label={`vs ${a.label}`} icon="🔎" />
              ))}
            </div>
          </div>
        </div>

        {/* Reconciliation placeholder */}
        <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
          <p className="text-xs text-zinc-600 italic">
            Reconciliation will appear after the Final Agent completes synthesis.
          </p>
        </div>
      </section>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Active state — show the battle                                         */
  /* ---------------------------------------------------------------------- */

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-white">Adversarial Review</h2>
          {criticCompleted && (
            <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
              {totalChallengeCount} Challenge{totalChallengeCount !== 1 ? "s" : ""}
            </span>
          )}
          {finalCompleted && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
              {resolvedCount} Resolved
            </span>
          )}
          {finalCompleted && unresolvedCount > 0 && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
              {unresolvedCount} Unresolved
            </span>
          )}
          {criticStep?.status === "running" && (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200 animate-pulse">
              Critiquing…
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Critic Agent challenges assumptions from Planner, Researcher, Risk, and
          Architect agents
        </p>
        {finalCompleted && criticAdjustment && (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
            <p className="text-xs font-semibold text-amber-100">
              Critic raised {totalChallengeCount} challenge{totalChallengeCount !== 1 ? "s" : ""}.{" "}
              {resolvedCount} resolved by Final Agent, {unresolvedCount} unresolved -&gt; score adjusted -{scorePenalty}.
            </p>
            <p className="mt-1 font-mono text-[10px] text-amber-200/70">
              {criticAdjustment.math}
            </p>
          </div>
        )}
      </div>

      {/* Battle Arena — Two-column layout */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* LEFT — Agent Claims */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold text-zinc-400">
              4
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Agent Claims
            </h3>
          </div>
          <div className="space-y-3">
            {CHALLENGED_AGENTS.map((agent) => {
              const step = stepMap.get(agent.name);
              const claim =
                step?.status === "completed"
                  ? extractClaim(step.output ?? "")
                  : step?.status === "running"
                  ? "Generating analysis…"
                  : "Waiting for analysis…";

              const isInactive =
                step?.status === "pending" || step?.status === "failed";

              if (isInactive) {
                return (
                  <PlaceholderCard
                    key={agent.name}
                    label={agent.label}
                    icon={agent.icon}
                  />
                );
              }

              return (
                <ClaimCard
                  key={agent.name}
                  icon={agent.icon}
                  label={agent.label}
                  claim={claim}
                  accentBorder={agent.accentBorder}
                  accentText={agent.accentText}
                  accentBg={agent.accentBg}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT — Critic Challenges */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-red-400/30 bg-red-400/10 text-[10px] font-bold text-red-300">
              🔎
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">
              Critic Challenges
            </h3>
          </div>
          <div className="space-y-3">
            {CHALLENGED_AGENTS.map((agent) => {
              if (!criticCompleted) {
                return (
                  <PlaceholderCard
                    key={agent.name}
                    label={`vs ${agent.label}`}
                    icon="🔎"
                  />
                );
              }

              const challenge = challenges.get(agent.name);
              if (!challenge) {
                return (
                  <div
                    key={agent.name}
                    className="rounded-2xl border border-white/5 bg-black/20 p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base leading-none">🔎</span>
                      <span className="text-xs font-bold text-zinc-500">
                        No challenge raised
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600">
                      Critic found no issues with {agent.label}&apos;s output.
                    </p>
                  </div>
                );
              }

              return (
                <ChallengeCard
                  key={agent.name}
                  agentLabel={agent.label}
                  challenge={challenge}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Battle connector — visual arrow from challenges to resolution */}
      {criticCompleted && (
        <div className="my-4 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-400/20 to-red-400/40" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-red-400/50"
            >
              <path
                d="M8 2v9m0 0l-3.5-3.5M8 11l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Reconciled by Final Agent
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-emerald-400/50"
            >
              <path
                d="M8 14V5m0 0l3.5 3.5M8 5L4.5 8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-400/20 to-emerald-400/40" />
        </div>
      )}

      {/* Reconciliation Row */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-[10px] font-bold text-emerald-300">
            ⚖️
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Final Agent Reconciliation
          </h3>
        </div>

        {finalCompleted ? (
          <>
            {/* Per-agent resolution cards */}
            <div className="space-y-3">
              {CHALLENGED_AGENTS.map((agent) => {
                const perAgentResolution = extractPerAgentResolution(
                  finalStep?.output,
                  agent.name
                );

                // Show resolution for each challenged agent
                const challengeExists = challenges.has(agent.name);

                if (!challengeExists && !perAgentResolution) {
                  return (
                    <div
                      key={agent.name}
                      className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-4"
                    >
                      <span className="text-base leading-none">{agent.icon}</span>
                      <span className="text-xs text-zinc-600">
                        {agent.label} — no challenges to resolve
                      </span>
                    </div>
                  );
                }

                // Build resolution text: per-agent extraction > general summary > fallback
                let resolutionText: string;
                if (perAgentResolution && perAgentResolution.length > 10) {
                  resolutionText = perAgentResolution;
                } else if (challengeExists) {
                  // Fallback: use the general final resolution as context
                  resolutionText = `Challenge addressed in final synthesis. ${finalResolution.slice(0, 160)}`;
                } else {
                  resolutionText = "Incorporated into final synthesis";
                }

                return (
                  <ResolutionRow
                    key={agent.name}
                    agentLabel={agent.label}
                    agentIcon={agent.icon}
                    resolution={resolutionText}
                    accentBorder={agent.accentBorder}
                  />
                );
              })}
            </div>

            {/* Final recommendation banner */}
            {report && (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base leading-none">⚖️</span>
                  <span className="text-sm font-bold text-cyan-200">
                    Final Recommendation
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      report.recommendation === "GO"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : report.recommendation === "NO_GO"
                        ? "border-red-400/30 bg-red-400/10 text-red-200"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {report.recommendation.replace("_", " ")}
                  </span>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">
                    {report.score}/100
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {report.summary}
                </p>
              </div>
            )}
          </>
        ) : criticCompleted ? (
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
              </span>
              <span className="text-xs text-cyan-300 font-semibold">
                Final Agent synthesizing reconciliation…
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
            <p className="text-xs text-zinc-600 italic">
              Reconciliation will appear after the Critic and Final Agent complete.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Legend
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[8px] font-bold text-red-200">
            CHALLENGED
          </span>
          <span className="text-xs text-zinc-400">Critic identified weakness</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-200">
            RESOLVED
          </span>
          <span className="text-xs text-zinc-400">Final Agent reconciliation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-gradient-to-r from-red-400/40 to-emerald-400/40" />
          <span className="text-xs text-zinc-400">Challenge → Resolution</span>
        </div>
      </div>
    </section>
  );
}
