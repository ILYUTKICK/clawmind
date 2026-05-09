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
  { from: "final_agent", to: "memory_writer", label: "decision report", color: "text-cyan-300" },
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
  memory_writer: "💾",
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
  memory_writer: "persistent-memory-writing",
};

// Model family badge colors
const MODEL_FAMILY_COLORS: Record<string, string> = {
  DeepSeek: "bg-blue-400/15 text-blue-300 border-blue-400/30",
  Qwen: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  "GLM-5": "bg-purple-400/15 text-purple-300 border-purple-400/30",
  "GLM-5.1": "bg-pink-400/15 text-pink-300 border-pink-400/30",
  Embedding: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",
  Local: "bg-zinc-400/15 text-zinc-400 border-zinc-400/30",
};

// Validation mode display
const VALIDATION_MODE_LABELS: Record<string, { label: string; color: string }> = {
  FIRST_ATTEMPT: { label: "Validated", color: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  REPAIR_RETRY_SAME_MODEL: { label: "Repaired", color: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  REPAIR_RETRY_SIMPLER_MODEL: { label: "Repaired (fallback model)", color: "border-orange-400/30 bg-orange-400/10 text-orange-300" },
  FALLBACK_PARTIAL: { label: "Validation failed", color: "border-red-400/30 bg-red-400/10 text-red-300" },
  NO_SCHEMA: { label: "N/A", color: "border-zinc-400/20 bg-zinc-400/5 text-zinc-500" },
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

function getModelShortId(modelId?: string): string {
  if (!modelId) return "";
  // e.g., "deepseek/deepseek-chat-v3-0324" → "deepseek-chat-v3"
  const withoutPrefix = modelId.includes("/") ? modelId.split("/").pop() ?? modelId : modelId;
  // Shorten known models
  if (withoutPrefix.includes("deepseek-chat-v3")) return "deepseek-v3";
  if (withoutPrefix.includes("qwen")) return "qwen3.6";
  if (withoutPrefix.includes("GLM-5.1")) return "GLM-5.1";
  if (withoutPrefix.includes("GLM-5")) return "GLM-5";
  return withoutPrefix.slice(0, 15);
}

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
    "memory_writer",
  ];

  // Count completed vs total
  const completedCount = agentOrder.filter((name) =>
    completedAgents.has(name)
  ).length;
  const totalCount = agentOrder.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Validation summary
  const validatedCount = steps.filter((s) => s.validation?.validated).length;
  const repairCount = steps.filter(
    (s) => s.validation?.mode === "REPAIR_RETRY_SAME_MODEL" || s.validation?.mode === "REPAIR_RETRY_SIMPLER_MODEL"
  ).length;
  const failedValidationCount = steps.filter(
    (s) => s.validation && !s.validation.validated
  ).length;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Agent Reasoning Flow
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Multi-agent orchestration with structured output validation. Each arrow
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

      {/* Validation summary bar */}
      {steps.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Validation:
          </span>
          {validatedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
              ✓ {validatedCount} validated
            </span>
          )}
          {repairCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-[10px] font-mono text-amber-300">
              ⚠ {repairCount} repaired
            </span>
          )}
          {failedValidationCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-red-400/20 bg-red-400/5 px-2 py-0.5 text-[10px] font-mono text-red-300">
              ✗ {failedValidationCount} failed
            </span>
          )}
          {/* Model diversity badge */}
          <span className="ml-auto inline-flex items-center gap-1 rounded border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-zinc-500">
            Multi-model ensemble: 4 models
          </span>
        </div>
      )}

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

          // Validation info
          const validation = step?.validation;
          const validationModeInfo = validation
            ? VALIDATION_MODE_LABELS[validation.mode] ?? VALIDATION_MODE_LABELS.NO_SCHEMA
            : null;

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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[10px] font-mono text-zinc-500 truncate">
                          {skill}
                        </p>
                        {step?.modelFamily && step.modelFamily !== "Local" && (
                          <span className={`inline-flex items-center rounded border px-1.5 py-px text-[8px] font-semibold ${MODEL_FAMILY_COLORS[step.modelFamily] ?? "bg-white/5 text-zinc-500 border-white/10"}`}>
                            {step.modelFamily}
                          </span>
                        )}
                        {step?.modelId && step.modelId !== "local" && step.modelId !== "all-MiniLM-L6-v2" && (
                          <span className="inline-flex items-center rounded border border-white/5 bg-white/[0.02] px-1.5 py-px text-[7px] font-mono text-zinc-600">
                            {getModelShortId(step.modelId)}
                          </span>
                        )}
                        {/* Validation badge */}
                        {validation && validationModeInfo && validation.mode !== "NO_SCHEMA" && (
                          <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[7px] font-semibold ${validationModeInfo.color}`}>
                            {validation.validated ? "✓" : "✗"} {validationModeInfo.label}
                            {validation.retriesUsed > 0 && (
                              <span className="text-[6px] opacity-70"> ({validation.retriesUsed}r)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Outgoing data count badge */}
                    {outgoingFlows.length > 0 && isCompleted && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono text-zinc-500">
                        → {outgoingFlows.length} output{outgoingFlows.length > 1 ? "s" : ""}
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
                    {step.output.length > 150 ? "..." : ""}
                  </p>
                )}

                {/* Expanded output */}
                {isExpanded && step?.output && (
                  <div className="mt-3 ml-8 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Raw Output
                      </span>
                      <div className="flex items-center gap-2">
                        {validation && validation.mode !== "NO_SCHEMA" && (
                          <span className="text-[9px] font-mono text-zinc-600">
                            {validation.validated ? "Zod ✓" : "Zod ✗"} | retries: {validation.retriesUsed} | model: {getModelShortId(validation.finalModel)}
                          </span>
                        )}
                        {step.startedAt && (
                          <span className="text-[10px] font-mono text-zinc-600">
                            {step.startedAt}
                          </span>
                        )}
                      </div>
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-400 scrollbar-thin">
                      {step.output}
                    </pre>
                    {/* Validation errors */}
                    {validation && !validation.validated && validation.errors.length > 0 && (
                      <div className="mt-2 rounded-lg border border-red-400/20 bg-red-400/5 p-2">
                        <p className="text-[10px] font-semibold text-red-300 mb-1">Validation Errors:</p>
                        {validation.errors.slice(0, 5).map((err, i) => (
                          <p key={i} className="text-[9px] text-red-300/70">{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Error display */}
                {status === "failed" && step?.error && (
                  <div className="mt-2.5 ml-8 rounded-lg border border-red-400/20 bg-red-400/5 p-2">
                    <p className="text-xs text-red-300">{step.error}</p>
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
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="inline-flex items-center rounded border border-emerald-400/30 bg-emerald-400/10 px-1 py-px text-[7px] text-emerald-300">✓ Validated</span>
          Zod schema
        </div>
      </div>
    </section>
  );
}
