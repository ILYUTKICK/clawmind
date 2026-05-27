"use client";

import { useState } from "react";
import { AgentStep, AgentName } from "@/lib/types";

type AgentReasoningFlowProps = {
  steps: AgentStep[];
  isLoading: boolean;
};

// Data flow connections between agents
const DATA_FLOWS: { from: AgentName; to: AgentName; label: string; color: string }[] = [
  { from: "memory_retrieval", to: "planner", label: "relevant memories", color: "text-cyan-300" },
  { from: "planner", to: "researcher", label: "execution plan", color: "text-purple-300" },
  { from: "researcher", to: "risk_agent", label: "research findings", color: "text-blue-300" },
  { from: "risk_agent", to: "architect", label: "risk map", color: "text-amber-300" },
  { from: "researcher", to: "architect", label: "research", color: "text-blue-300" },
  { from: "architect", to: "critic", label: "architecture", color: "text-emerald-300" },
  { from: "risk_agent", to: "critic", label: "risks", color: "text-amber-300" },
  { from: "critic", to: "final_agent", label: "critique", color: "text-pink-300" },
  { from: "planner", to: "critic", label: "plan", color: "text-purple-300" },
  { from: "final_agent", to: "report_storage", label: "decision report", color: "text-cyan-300" },
  { from: "report_storage", to: "memory_index", label: "report uri", color: "text-emerald-300" },
  { from: "report_storage", to: "onchain_registry", label: "root hash", color: "text-emerald-300" },
];

// Agent icons/emojis for visual flair
const AGENT_ICONS: Record<string, string> = {
  memory_retrieval: "🧠",
  planner: "📋",
  researcher: "🔍",
  risk_agent: "⚡",
  architect: "🏗️",
  critic: "🔎",
  final_agent: "⚖️",
  report_storage: "▣",
  memory_writer: "💾",
  memory_index: "◇",
  onchain_registry: "⌁",
};

// Skill labels for each agent
const AGENT_SKILLS: Record<string, string> = {
  memory_retrieval: "persistent-memory-retrieval",
  planner: "task-decomposition",
  researcher: "research-extraction",
  risk_agent: "web3-risk-analysis",
  architect: "architecture-design",
  critic: "adversarial-review",
  final_agent: "decision-synthesis",
  report_storage: "0g-report-storage",
  memory_writer: "persistent-memory-writing",
  memory_index: "semantic-memory-index",
  onchain_registry: "eip712-registry-write",
};

// Color mapping for data flow arrows (SVG stroke colors)
const FLOW_STROKE: Record<string, string> = {
  "text-cyan-300": "#67e8f9",
  "text-purple-300": "#c4b5fd",
  "text-blue-300": "#93c5fd",
  "text-amber-300": "#fcd34d",
  "text-emerald-300": "#6ee7b7",
  "text-pink-300": "#f9a8d4",
};

function statusIcon(status: AgentStep["status"]): string {
  if (status === "completed") return "✓";
  if (status === "running") return "●";
  if (status === "failed") return "✗";
  return "○";
}

function statusColor(status: AgentStep["status"]): string {
  if (status === "completed") return "text-emerald-400";
  if (status === "running") return "text-cyan-400 animate-pulse";
  if (status === "failed") return "text-red-400";
  return "text-zinc-500";
}

function statusBadgeClass(status: AgentStep["status"]): string {
  if (status === "completed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "running") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
  if (status === "failed") return "border-red-400/30 bg-red-400/10 text-red-300";
  return "border-white/10 bg-white/5 text-zinc-500";
}

// Validation mode labels
const VALIDATION_MODE_LABELS: Record<string, string> = {
  NO_SCHEMA: "No Schema",
  WEAK: "Weak",
  STRICT: "Strict",
  RETRY: "Retry",
  FALLBACK: "Fallback",
};

export function AgentReasoningFlow({ steps, isLoading }: AgentReasoningFlowProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Build a map for quick step lookup
  const stepMap = new Map(steps.map((s) => [s.name, s]));

  // Determine which agents have completed
  const completedAgents = new Set(
    steps.filter((s) => s.status === "completed").map((s) => s.name)
  );

  // Default agent order
  const agentOrder: AgentStep["name"][] = [
    "memory_retrieval",
    "planner",
    "researcher",
    "risk_agent",
    "architect",
    "critic",
    "final_agent",
    "report_storage",
    "memory_index",
    "onchain_registry",
  ];

  // Count completed vs total
  const completedCount = agentOrder.filter((name) =>
    completedAgents.has(name)
  ).length;
  const totalCount = agentOrder.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Agent Reasoning Flow
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Multi-agent orchestration with data flow visualization. Each arrow
            shows what context passes between agents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {completedCount > 0 && (
            <span className="text-xs font-mono text-zinc-500">
              {completedCount}/{totalCount}
            </span>
          )}
          {isLoading && (
            <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200 animate-pulse">
              Running Pipeline
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Agent nodes with connecting lines */}
      <div className="relative">
        {agentOrder.map((agentName, index) => {
          const step = stepMap.get(agentName);
          const status = step?.status ?? "pending";
          const isCompleted = status === "completed";
          const isRunning = status === "running";
          const isExpanded = expandedAgent === agentName;
          const icon = AGENT_ICONS[agentName] || "●";
          const skill = AGENT_SKILLS[agentName] || agentName;
          const label =
            step?.label ??
            agentName
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());

          // Find data flows coming INTO this agent
          const incomingFlows = DATA_FLOWS.filter(
            (f) => f.to === agentName
          );

          // Find data flows going OUT of this agent
          const outgoingFlows = DATA_FLOWS.filter(
            (f) => f.from === agentName
          );

          return (
            <div key={agentName}>
              {/* Incoming data flow labels */}
              {incomingFlows.length > 0 && (
                <div className="mb-1.5 ml-6 flex flex-wrap gap-1.5 pl-5">
                  {incomingFlows.map((flow) => {
                    const fromStep = stepMap.get(flow.from);
                    const fromCompleted = fromStep?.status === "completed";
                    const strokeColor = FLOW_STROKE[flow.color] ?? "#a1a1aa";
                    return (
                      <span
                        key={`${flow.from}-${flow.to}`}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono ${
                          fromCompleted
                            ? `${flow.color} border-white/10 bg-white/[0.03]`
                            : "text-zinc-600 border-white/5 bg-transparent"
                        }`}
                      >
                        <svg
                          width="14"
                          height="10"
                          viewBox="0 0 14 10"
                          className={fromCompleted ? "opacity-80" : "opacity-20"}
                        >
                          <line
                            x1="0"
                            y1="5"
                            x2="9"
                            y2="5"
                            stroke={strokeColor}
                            strokeWidth="1.5"
                            strokeDasharray={fromCompleted ? "none" : "2 2"}
                          />
                          <polygon
                            points="9,2 14,5 9,8"
                            fill={strokeColor}
                          />
                        </svg>
                        {flow.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Agent node */}
              <button
                type="button"
                className={`
                  group w-full rounded-2xl border p-4 text-left transition-all duration-200
                  ${isCompleted ? "border-emerald-400/20 bg-emerald-400/[0.03]" : ""}
                  ${isRunning ? "border-cyan-400/40 bg-cyan-400/[0.05] shadow-lg shadow-cyan-400/5" : ""}
                  ${status === "pending" ? "border-white/5 bg-black/10" : ""}
                  ${status === "failed" ? "border-red-400/20 bg-red-400/[0.03]" : ""}
                  hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20
                `}
                onClick={() =>
                  setExpandedAgent(isExpanded ? null : agentName)
                }
                aria-expanded={isExpanded}
                aria-label={`${label} agent — ${status}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Agent icon with glow for running */}
                    <div className="relative flex-shrink-0">
                      <span className="text-lg leading-none">{icon}</span>
                      {isRunning && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isCompleted
                            ? "text-white"
                            : isRunning
                            ? "text-cyan-200"
                            : "text-zinc-400"
                        }`}
                      >
                        {index + 1}. {label}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500 truncate">
                        {skill}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Outgoing data count badge */}
                    {outgoingFlows.length > 0 && isCompleted && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono text-zinc-500">
                        → {outgoingFlows.length} output{outgoingFlows.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {/* Validation badge */}
                    {step?.validation && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-mono ${
                          step.validation.validated
                            ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400"
                            : "border-amber-400/20 bg-amber-400/5 text-amber-400"
                        }`}
                      >
                        {step.validation.validated ? "✓" : "✗"}{" "}
                        {VALIDATION_MODE_LABELS[step.validation.mode ?? "NO_SCHEMA"]}
                        {(step.validation.retriesUsed ?? 0) > 0 && (
                          <span className="text-[6px] opacity-70"> ({step.validation.retriesUsed} retries)</span>
                        )}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(status)}`}
                    >
                      <span className={statusColor(status)}>
                        {statusIcon(status)}
                      </span>
                      {status === "completed"
                        ? "Done"
                        : status === "running"
                        ? "Running"
                        : status === "failed"
                        ? "Failed"
                        : "Pending"}
                    </span>
                    {/* Expand/collapse chevron */}
                    <svg
                      className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Output preview (when completed, not expanded) */}
                {isCompleted && step?.output && !isExpanded && (
                  <p className="mt-2.5 pl-8 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                    {step.output.slice(0, 150)}
                    {step.output.length > 150 ? "…" : ""}
                  </p>
                )}

                {/* Expanded output */}
                {isExpanded && step?.output && (
                  <div className="mt-3 ml-8 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Raw Output
                      </span>
                      {step.startedAt && (
                        <span className="text-[10px] font-mono text-zinc-600">
                          {step.startedAt}
                        </span>
                      )}
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-400 scrollbar-thin">
                      {step.output}
                    </pre>
                  </div>
                )}

                {/* Error display */}
                {status === "failed" && step?.error && (
                  <div className="mt-2.5 ml-8 rounded-lg border border-red-400/20 bg-red-400/5 p-2">
                    <p className="text-xs text-red-300">{step.error}</p>
                  </div>
                )}

                {/* Validation details (expanded) */}
                {isExpanded && step?.validation && (
                  <div className="mt-2.5 ml-8 rounded-lg border border-white/10 bg-black/20 p-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Validation
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8px] font-mono ${
                          step.validation.validated
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-amber-400/10 text-amber-400"
                        }`}
                      >
                        {step.validation.validated ? "PASSED" : "FAILED"}
                      </span>
                      {step.validation.mode && (
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-mono text-zinc-400">
                          {VALIDATION_MODE_LABELS[step.validation.mode] ?? step.validation.mode}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-mono text-zinc-500">
                      {step.validation.model && (
                        <span>Model: {step.validation.model}</span>
                      )}
                      {step.validation.finalModel && step.validation.finalModel !== step.validation.model && (
                        <span>Final: {step.validation.finalModel}</span>
                      )}
                      {(step.validation.retriesUsed ?? 0) > 0 && (
                        <span>Retries: {step.validation.retriesUsed}/{step.validation.retries ?? "?"}</span>
                      )}
                    </div>
                    {step.validation.errors && step.validation.errors.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {step.validation.errors.map((err, i) => (
                          <p key={i} className="text-[9px] font-mono text-red-400/80">
                            ⚠ {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </button>

              {/* Connecting line to next agent */}
              {index < agentOrder.length - 1 && (
                <div className="flex items-center justify-center py-0.5">
                  {/* Vertical connector line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-px h-5 transition-colors duration-500 ${
                        completedAgents.has(agentName)
                          ? "bg-emerald-400/30"
                          : isRunning
                          ? "bg-cyan-400/20"
                          : "bg-white/5"
                      }`}
                    />
                    {/* Small dot at junction if this agent is complete */}
                    {completedAgents.has(agentName) && (
                      <div className="h-1 w-1 rounded-full bg-emerald-400/40" />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="text-emerald-400">✓</span> Completed
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="text-cyan-400 animate-pulse">●</span> Running
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="text-zinc-500">○</span> Pending
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <svg width="14" height="10" viewBox="0 0 14 10">
            <line
              x1="0"
              y1="5"
              x2="9"
              y2="5"
              stroke="#a1a1aa"
              strokeWidth="1.5"
            />
            <polygon points="9,2 14,5 9,8" fill="#a1a1aa" />
          </svg>
          Data flow
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/40" />
          Active connection
        </div>
      </div>
    </section>
  );
}
