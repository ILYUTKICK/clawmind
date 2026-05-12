"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdversarialPanel } from "@/components/AdversarialPanel";
import { IntegrityPanel } from "@/components/IntegrityPanel";
import { MemoryPanel } from "@/components/MemoryPanel";
import { ReportView } from "@/components/ReportView";
import { RetrievedReportPanel } from "@/components/RetrievedReportPanel";
import { StorageReceipt } from "@/components/StorageReceipt";
import type { AnalysisResult, AgentName, AgentStep } from "@/lib/types";
import type { InfrastructureStatus } from "@/lib/infrastructure-status";

type TaskPollResponse = {
  taskId: string;
  task: string;
  source?: "web" | "mcp";
  status: "running" | "completed" | "failed";
  currentStep: string;
  steps: AgentStep[];
  result: AnalysisResult | null;
  error: string | null;
  updatedAt: string;
};

type ExampleTask = {
  label: string;
  prediction: "GO" | "NO_GO" | "INVESTIGATE_MORE" | "EDGE";
  task: string;
};

const POLL_INTERVAL_MS = 3000;

const DEFAULT_TASK =
  "Cross-chain bridge between Base and Solana using a 3/5 multisig of anonymous signers. One audit by a mid-tier firm 9 months ago, no bug bounty. $18M TVL claimed, on-chain shows $6M. Token launch in 14 days.";

const EXAMPLES: ExampleTask[] = [
  {
    label: "Mature audited fork",
    prediction: "GO",
    task: "Mature Uniswap V3 fork on Base, $42M TVL, two independent audits (Trail of Bits + Halborn), doxxed core team, 7-day timelock on all admin functions, no upgradeability outside multisig. No new financial primitives.",
  },
  {
    label: "Private key in env",
    prediction: "NO_GO",
    task: "Self-custodial yield aggregator that asks users to paste their wallet private key into an .env file on the agent host so the bot can rebalance positions. Anonymous team, no audits, code obfuscated.",
  },
  {
    label: "Cross-chain · anon team",
    prediction: "INVESTIGATE_MORE",
    task: DEFAULT_TASK,
  },
  {
    label: "Liquid staking · timelock",
    prediction: "EDGE",
    task: "Liquid staking protocol on a new L2. Validators rotated weekly via on-chain governance. 48h timelock, two audits, public team. Novel re-staking primitive with custom slashing math. $12M TVL, growing 20% w/w.",
  },
];

const AGENT_ORDER: AgentName[] = [
  "memory_retrieval",
  "planner",
  "researcher",
  "risk_agent",
  "architect",
  "critic",
  "final_agent",
  "memory_writer",
];

const AGENT_META: Record<AgentName, { label: string; model: string; idle: string }> = {
  memory_retrieval: {
    label: "Memory Retrieval",
    model: "embeddings/all-MiniLM-L6-v2",
    idle: "Retrieve semantic precedents from the 0G-backed memory index.",
  },
  planner: {
    label: "Planner",
    model: "deepseek-chat-v3",
    idle: "Break task into research, risk, architecture, and verification tracks.",
  },
  researcher: {
    label: "Researcher",
    model: "qwen-2.5-72b",
    idle: "Collect project facts, constraints, and external risk signals.",
  },
  risk_agent: {
    label: "Risk Assessment",
    model: "glm-4.5-air",
    idle: "Score custody, governance, operational, and economic exposure.",
  },
  architect: {
    label: "Architect",
    model: "deepseek-chat-v3",
    idle: "Build an attack tree and system-level threat model.",
  },
  critic: {
    label: "Critic",
    model: "claude-haiku-4-5",
    idle: "Challenge conclusions and apply unresolved severity penalties.",
  },
  final_agent: {
    label: "Final Synthesis",
    model: "deepseek-chat-v3",
    idle: "Combine agent outputs into a final score, recommendation, and report.",
  },
  memory_writer: {
    label: "Memory Writer",
    model: "embeddings/all-MiniLM-L6-v2",
    idle: "Persist the completed report into runtime semantic memory.",
  },
};

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function shortHash(value?: string, head = 8, tail = 4): string {
  if (!value) return "pending";
  if (value.length <= head + tail + 5) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function normalizeStepLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function statusLabel(status: AgentStep["status"] | "pending"): string {
  if (status === "completed") return "completed";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "pending";
}

function stepStatusClasses(status: AgentStep["status"] | "pending", isCritic: boolean): string {
  if (status === "running" && isCritic) {
    return "border-[var(--cm-warning)]/60 bg-[var(--cm-warning)]/5";
  }

  if (status === "running") {
    return "border-[var(--cm-accent)]/50 bg-[var(--cm-accent)]/5";
  }

  if (status === "completed" && isCritic) {
    return "border-[var(--cm-warning)]/35 bg-[var(--cm-surface)]";
  }

  if (status === "completed") {
    return "border-[var(--cm-border)] bg-[var(--cm-surface)]";
  }

  if (status === "failed") {
    return "border-[var(--cm-critical)]/50 bg-[var(--cm-critical)]/5";
  }

  return "border-[var(--cm-border)] bg-[var(--cm-surface)] opacity-70";
}

function recommendationClass(recommendation?: AnalysisResult["report"]["recommendation"]): string {
  if (recommendation === "GO") {
    return "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200";
  }

  if (recommendation === "NO_GO") {
    return "border-[var(--cm-critical)] bg-[var(--cm-critical)]/10 text-red-200";
  }

  return "border-[var(--cm-warning)] bg-[var(--cm-warning)]/10 text-amber-200";
}

function scoreColor(recommendation?: AnalysisResult["report"]["recommendation"]): string {
  if (recommendation === "GO") return "var(--cm-accent)";
  if (recommendation === "NO_GO") return "var(--cm-critical)";
  return "var(--cm-warning)";
}

function dotClass(prediction: ExampleTask["prediction"]): string {
  if (prediction === "GO") return "bg-[var(--cm-accent)]";
  if (prediction === "NO_GO") return "bg-[var(--cm-critical)]";
  if (prediction === "INVESTIGATE_MORE") return "bg-[var(--cm-warning)]";
  return "bg-[var(--cm-text-secondary)]";
}

function TerminalLines({
  steps,
  currentStep,
}: {
  steps: AgentStep[];
  currentStep: string;
}) {
  const lines = useMemo(() => {
    const derived = steps.flatMap((step) => {
      const meta = AGENT_META[step.name];
      const label = meta?.label ?? step.label;
      const body = step.output || step.error || meta?.idle || step.label;
      const firstLine = body.split("\n").find(Boolean)?.slice(0, 220);

      if (!firstLine) return [];

      return [{
        agent: label.toLowerCase().replace(/\s+/g, "-"),
        text: firstLine,
        status: step.status,
      }];
    });

    if (derived.length > 0) {
      return derived.slice(-12);
    }

    return [{
      agent: currentStep ? normalizeStepLabel(currentStep) : "pipeline",
      text: currentStep ? "waiting for first agent output" : "idle · submit a task to start the pipeline",
      status: "pending" as const,
    }];
  }, [currentStep, steps]);

  return (
    <div className="h-60 overflow-y-auto bg-[#08080a] p-3 [font-family:var(--cm-font-mono)] text-[11px] leading-5 text-[var(--cm-text-secondary)]">
      {lines.map((line, index) => (
        <div key={`${line.agent}-${index}`} className="block whitespace-pre-wrap break-words">
          <span className="mr-2 text-[var(--cm-text-muted)]">
            {new Date().toLocaleTimeString("en-GB", { hour12: false })}
          </span>
          <span className={line.status === "running" ? "mr-2 text-[var(--cm-accent)]" : "mr-2 text-[var(--cm-text-muted)]"}>
            [{line.agent}]
          </span>
          {line.text}
        </div>
      ))}
    </div>
  );
}

function PipelineStepCard({
  name,
  index,
  step,
}: {
  name: AgentName;
  index: number;
  step?: AgentStep;
}) {
  const meta = AGENT_META[name];
  const status = step?.status ?? "pending";
  const isCritic = name === "critic";
  const model = step?.modelId || step?.model || meta.model;
  const summary = step?.output || step?.error || meta.idle;
  const isOpen = status === "running" || status === "completed" || status === "failed";

  return (
    <details
      open={isOpen}
      className={`group relative overflow-hidden rounded-lg border transition ${stepStatusClasses(status, isCritic)}`}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
        <span className="w-6 [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--cm-text-primary)]">
            {meta.label}
            {status === "running" ? (
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--cm-accent)] align-middle animate-pulse" />
            ) : null}
          </span>
          <span className="block truncate [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)]">
            {statusLabel(status)}
          </span>
        </span>
        <span className={status === "completed" ? "text-[var(--cm-accent)]" : status === "running" ? "text-[var(--cm-accent)] animate-pulse" : status === "failed" ? "text-[var(--cm-critical)]" : "text-[var(--cm-text-muted)]"}>
          {status === "completed" ? "✓" : status === "failed" ? "!" : status === "running" ? "●" : "·"}
        </span>
      </summary>

      <div className="border-t border-[var(--cm-border)] px-10 pb-4 pt-3 [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)]">
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[76px_minmax(0,1fr)]">
            <span>Model</span>
            <span className="truncate text-[var(--cm-text-secondary)]">{model}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[76px_minmax(0,1fr)]">
            <span>Output</span>
            <span className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[var(--cm-text-secondary)]">
              {summary}
            </span>
          </div>
          {isCritic && status !== "pending" ? (
            <div className="mt-2 rounded-md border border-[var(--cm-warning)]/30 bg-[var(--cm-warning)]/5 px-3 py-2 text-[var(--cm-warning)]">
              Critic challenges feed directly into score adjustment math.
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function MetricsPanel({
  elapsedMs,
  steps,
  isLoading,
}: {
  elapsedMs: number;
  steps: AgentStep[];
  isLoading: boolean;
}) {
  const completed = steps.filter((step) => step.status === "completed").length;
  const models = new Set(
    steps
      .map((step) => step.modelId || step.model)
      .filter((model): model is string => Boolean(model)),
  );

  return (
    <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
      <div className="border-b border-[var(--cm-border)] px-4 py-3">
        <h3 className="[font-family:var(--cm-font-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cm-text-secondary)]">
          Metrics
        </h3>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 p-4 [font-family:var(--cm-font-mono)] text-xs">
        <span className="uppercase text-[10px] tracking-[0.06em] text-[var(--cm-text-muted)]">Elapsed</span>
        <span>{formatElapsed(elapsedMs)}</span>
        <span className="uppercase text-[10px] tracking-[0.06em] text-[var(--cm-text-muted)]">Steps completed</span>
        <span>{completed} of 8</span>
        <span className="uppercase text-[10px] tracking-[0.06em] text-[var(--cm-text-muted)]">Models observed</span>
        <span>{models.size || 0} of 5</span>
        <div className="col-span-2 my-1 border-t border-dashed border-[var(--cm-border-emphasis)]" />
        <span className="uppercase text-[10px] tracking-[0.06em] text-[var(--cm-text-muted)]">Projected finish</span>
        <span>{isLoading ? "~30-60s" : completed === 8 ? "complete" : "pending"}</span>
      </div>
    </div>
  );
}

function ChainStatusPanel({ analysis, isLoading }: { analysis: AnalysisResult | null; isLoading: boolean }) {
  const receipt = analysis?.onChainReceipt;
  const rootHash = analysis?.receipt.reportHash;

  const rows = [
    ["Task hash", receipt?.taskHash],
    ["Root hash", rootHash],
    ["Signature", receipt?.signature],
    ["Tx", receipt?.txHash],
  ] as const;

  return (
    <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
      <div className="border-b border-[var(--cm-border)] px-4 py-3">
        <h3 className="[font-family:var(--cm-font-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cm-text-secondary)]">
          On-chain status
        </h3>
      </div>
      <div className="space-y-2 p-4 [font-family:var(--cm-font-mono)] text-[11px]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2">
            <span className="uppercase text-[10px] tracking-[0.06em] text-[var(--cm-text-muted)]">{label}</span>
            <span className={value ? "truncate text-[var(--cm-text-primary)]" : isLoading ? "truncate text-[var(--cm-warning)]" : "truncate text-[var(--cm-text-muted)]"}>
              {value ? shortHash(value) : isLoading ? "pending" : "idle"}
            </span>
            <span className={value ? "grid h-4 w-4 place-items-center rounded-full border border-[var(--cm-accent)]/40 bg-[var(--cm-accent)]/10 text-[9px] text-[var(--cm-accent)]" : "h-4 w-4 rounded-full border border-[var(--cm-border-emphasis)]"}>{value ? "✓" : ""}</span>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-[var(--cm-border-emphasis)] pt-3 text-[10px] text-[var(--cm-text-muted)]">
          <span>EIP-712 · 0G storage</span>
          <span className={receipt?.signatureVerified ? "text-[var(--cm-accent)]" : "text-[var(--cm-text-muted)]"}>
            {receipt?.signatureVerified ? "verified · 0G" : isLoading ? "waiting" : "unverified"}
          </span>
        </div>
      </div>
    </div>
  );
}

function MemoryContext({
  memories,
  isLoading,
}: {
  memories?: AnalysisResult["relevantMemories"];
  isLoading: boolean;
}) {
  const visible = memories?.slice(0, 3) ?? [];

  return (
    <details className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [font-family:var(--cm-font-mono)] text-xs">
        <span className="text-[var(--cm-text-secondary)]">Memory context</span>
        <span className="text-[var(--cm-text-primary)]">· {visible.length || (isLoading ? "resolving" : "ready")}</span>
        <span className="ml-auto text-[var(--cm-text-muted)]">semantic retrieval</span>
      </summary>
      <div className="border-t border-[var(--cm-border)] p-3">
        {visible.length > 0 ? (
          <div className="space-y-2">
            {visible.map((memory) => (
              <div key={memory.id} className="grid gap-2 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface-elevated)] px-3 py-2 [font-family:var(--cm-font-mono)] text-[11px] sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
                <span className="text-[var(--cm-text-primary)]">{memory.id}</span>
                <span className="text-[var(--cm-accent)]">
                  {typeof memory.similarityScore === "number" ? `sim ${memory.similarityScore.toFixed(2)}` : "runtime"}
                </span>
                <span className="truncate font-sans text-xs text-[var(--cm-text-secondary)]">{memory.summary}</span>
                <span className="rounded border border-[var(--cm-border-emphasis)] px-2 py-0.5 text-[10px] uppercase text-[var(--cm-text-muted)]">
                  {memory.id.startsWith("mem_generated_") ? "runtime" : "seed"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--cm-text-muted)]">
            The first pipeline step embeds the task and retrieves top-K memories before planning.
          </p>
        )}
      </div>
    </details>
  );
}

function InputPhase({
  task,
  setTask,
  onRun,
  isLoading,
  requestError,
}: {
  task: string;
  setTask: (task: string) => void;
  onRun: () => void;
  isLoading: boolean;
  requestError: string | null;
}) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-7 px-5 py-12 sm:px-8 sm:py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-normal text-[var(--cm-text-primary)]">
          New analysis
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cm-text-secondary)]">
          Describe a Web3 project, protocol, or agentic system. 8 agents will analyze it in 30-60 seconds.
        </p>
      </header>

      <MemoryContext isLoading={false} />

      <div className="relative">
        <textarea
          value={task}
          onChange={(event) => setTask(event.target.value)}
          placeholder="E.g., Audit a Uniswap V3 fork on Base with novel TWAP oracle, $5M TVL, audited once by Halborn, anonymous team, multisig with 24h timelock..."
          className="min-h-36 w-full resize-y rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-3 text-sm leading-6 text-[var(--cm-text-primary)] outline-none transition placeholder:text-[var(--cm-text-muted)] focus:border-[var(--cm-border-emphasis)]"
        />
        <div className="pointer-events-none absolute bottom-3 right-3 [font-family:var(--cm-font-mono)] text-[10px] text-[var(--cm-text-muted)]">
          {task.length} chars
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => setTask(example.task)}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-border-emphasis)] hover:bg-[var(--cm-surface-elevated)] hover:text-[var(--cm-text-primary)]"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass(example.prediction)}`} />
            {example.label}
          </button>
        ))}
      </div>

      {requestError ? (
        <div className="rounded-lg border border-[var(--cm-critical)]/40 bg-[var(--cm-critical)]/10 px-4 py-3 text-sm text-red-200">
          {requestError}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={isLoading}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--cm-accent)] px-5 [font-family:var(--cm-font-mono)] text-sm font-semibold text-[#06302c] transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Running analysis..." : "Run analysis →"}
        </button>
        <p className="text-center [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)]">
          8 agents · multi-model · est. 30-60s · ~$0.03 · signed and recorded on 0G
        </p>
      </div>
    </section>
  );
}

function LivePhase({
  taskId,
  steps,
  currentStep,
  elapsedMs,
  isLoading,
  requestError,
  analysis,
  onReset,
}: {
  taskId: string | null;
  steps: AgentStep[];
  currentStep: string;
  elapsedMs: number;
  isLoading: boolean;
  requestError: string | null;
  analysis: AnalysisResult | null;
  onReset: () => void;
}) {
  const stepMap = new Map(steps.map((step) => [step.name, step]));
  const completed = AGENT_ORDER.filter((name) => stepMap.get(name)?.status === "completed").length;
  const progress = Math.round((completed / AGENT_ORDER.length) * 100);

  return (
    <section className="flex flex-col">
      <div className="sticky top-0 z-10 grid gap-4 border-b border-[var(--cm-border)] bg-[var(--cm-surface)] px-5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-6">
        <div className="flex items-center gap-3 [font-family:var(--cm-font-mono)] text-xs">
          <span className="text-[var(--cm-text-primary)]">Analysis {taskId ? shortHash(taskId, 8, 4) : "pending"}</span>
          <span className={requestError ? "text-[var(--cm-critical)]" : analysis ? "text-[var(--cm-accent)]" : "inline-flex items-center gap-2 text-[var(--cm-accent)]"}>
            {!requestError && !analysis ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--cm-accent)] animate-pulse" /> : null}
            {requestError ? "failed" : analysis ? "complete" : "running"}
          </span>
        </div>

        <div className="min-w-0">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--cm-border)]">
            <div className="h-full bg-[var(--cm-accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)]">
            <span><b className="text-[var(--cm-text-secondary)]">{completed} of 8</b> · {currentStep ? normalizeStepLabel(currentStep) : "starting"}</span>
            <span><b className="text-[var(--cm-text-secondary)]">{formatElapsed(elapsedMs)}</b> elapsed</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-[var(--cm-border)] px-3 py-2 [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)] transition hover:border-[var(--cm-border-emphasis)] hover:text-[var(--cm-text-primary)]"
        >
          New task
        </button>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
        <div className="flex min-w-0 flex-col gap-2">
          {AGENT_ORDER.map((name, index) => (
            <PipelineStepCard key={name} name={name} index={index} step={stepMap.get(name)} />
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--cm-border)] px-4 py-3">
              <h3 className="[font-family:var(--cm-font-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cm-text-secondary)]">
                Live output <b className="normal-case tracking-normal text-[var(--cm-text-primary)]">· {currentStep ? normalizeStepLabel(currentStep) : "idle"}</b>
              </h3>
              <span className={isLoading ? "text-[var(--cm-accent)]" : "text-[var(--cm-text-muted)]"}>
                {isLoading ? "streaming" : analysis ? "done" : "idle"}
              </span>
            </div>
            <TerminalLines steps={steps} currentStep={currentStep} />
          </div>

          <MetricsPanel elapsedMs={elapsedMs} steps={steps} isLoading={isLoading} />
          <ChainStatusPanel analysis={analysis} isLoading={isLoading} />
        </aside>
      </div>
    </section>
  );
}

function ScoreTransition({ analysis }: { analysis: AnalysisResult }) {
  const report = analysis.report;
  const adjustment = report.criticAdjustment;
  const baseScore = adjustment?.baseScore ?? Math.min(100, report.score + (adjustment?.penalty ?? 0));

  return (
    <div className="flex flex-col items-center gap-5 border-b border-[var(--cm-border)] px-5 py-8 text-center">
      <div className="flex max-w-5xl flex-wrap justify-center gap-2">
        {AGENT_ORDER.map((name, index) => (
          <span
            key={name}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-1 [font-family:var(--cm-font-mono)] text-[11px] text-[var(--cm-text-muted)]"
          >
            <span className="text-[var(--cm-accent)]">✓</span>
            <b className="font-medium text-[var(--cm-text-secondary)]">{String(index + 1).padStart(2, "0")}</b>
            {AGENT_META[name].label}
          </span>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className="grid h-40 w-40 place-items-center rounded-full p-2"
          style={{
            background: `conic-gradient(${scoreColor(report.recommendation)} ${Math.max(0, Math.min(100, report.score)) * 3.6}deg, var(--cm-border) 0deg)`,
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-[var(--cm-background)] text-center">
            <div>
              <div className="[font-family:var(--cm-font-mono)] text-6xl font-semibold leading-none">{report.score}</div>
              <div className="mt-1 [font-family:var(--cm-font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">/ 100</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 [font-family:var(--cm-font-mono)] text-xs text-[var(--cm-text-muted)]">
          <span>Initial <b className="text-[var(--cm-text-secondary)]">{baseScore}</b></span>
          <span>·</span>
          <span>Critic adjustment <span className="text-[var(--cm-critical)]">-{adjustment?.penalty ?? Math.max(0, baseScore - report.score)}</span></span>
        </div>

        <span className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 [font-family:var(--cm-font-mono)] text-sm font-semibold tracking-[0.04em] ${recommendationClass(report.recommendation)}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {report.recommendation}
        </span>
      </div>
    </div>
  );
}

function ReportPhase({ analysis, onReset }: { analysis: AnalysisResult; onReset: () => void }) {
  return (
    <section className="flex flex-col">
      <ScoreTransition analysis={analysis} />

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
        <div className="min-w-0 space-y-5">
          <ReportView
            report={analysis.report}
            task={analysis.task}
            receipt={{
              reportHash: analysis.receipt.reportHash,
              storageUri: analysis.receipt.storageUri,
              provider: analysis.receipt.provider,
            }}
            onChainReceipt={analysis.onChainReceipt}
          />
          <AdversarialPanel steps={analysis.steps} report={analysis.report} />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <IntegrityPanel
            reportHash={analysis.receipt.reportHash}
            onChainReceipt={analysis.onChainReceipt}
          />
          <MemoryPanel memories={analysis.relevantMemories} />
          <StorageReceipt receipt={analysis.receipt} />
          <RetrievedReportPanel defaultStorageUri={analysis.receipt.storageUri} />
          <button
            type="button"
            onClick={onReset}
            className="w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-3 [font-family:var(--cm-font-mono)] text-sm text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-border-emphasis)] hover:text-[var(--cm-text-primary)]"
          >
            Run another analysis →
          </button>
        </aside>
      </div>
    </section>
  );
}

export default function AnalyzeExperience() {
  const [task, setTask] = useState(DEFAULT_TASK);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [infraStatus, setInfraStatus] = useState<InfrastructureStatus | null>(null);
  const [currentStep, setCurrentStep] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => {
        if (!res.ok) throw new Error("Status check failed");
        return res.json();
      })
      .then((data: InfrastructureStatus) => setInfraStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoading || !startedAt) return;

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => window.clearInterval(timer);
  }, [isLoading, startedAt]);

  const startPolling = useCallback((nextTaskId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/status?taskId=${nextTaskId}`);

        if (!res.ok) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsLoading(false);
          setRequestError("Task status not found. It may have expired.");
          return;
        }

        const data = (await res.json()) as TaskPollResponse;
        setLiveSteps(data.steps);
        setCurrentStep(data.currentStep);

        if (data.status === "completed" && data.result) {
          setAnalysis(data.result);
          setIsLoading(false);
          setElapsedMs((current) => current || Date.now() - (startedAt ?? Date.now()));
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === "failed") {
          setIsLoading(false);
          setRequestError(data.error || "Pipeline failed unexpectedly.");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Keep polling; transient network failures should not kill a run.
      }
    };

    poll();
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [startedAt]);

  async function runAnalysis() {
    const trimmedTask = task.trim();

    if (trimmedTask.length < 10) {
      setRequestError("Describe the project in at least 10 characters.");
      return;
    }

    const now = Date.now();
    setStartedAt(now);
    setElapsedMs(0);
    setIsLoading(true);
    setRequestError(null);
    setAnalysis(null);
    setLiveSteps([]);
    setCurrentStep("starting");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmedTask }),
      });

      const data = (await response.json()) as {
        taskId?: string;
        status?: string;
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(data.details || data.error || "Analysis request failed.");
      }

      if (!data.taskId) {
        throw new Error("No taskId returned from server.");
      }

      setTaskId(data.taskId);
      startPolling(data.taskId);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unknown request error");
      setIsLoading(false);
    }
  }

  function resetRun() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setAnalysis(null);
    setLiveSteps([]);
    setIsLoading(false);
    setRequestError(null);
    setCurrentStep("");
    setElapsedMs(0);
    setStartedAt(null);
    setTaskId(null);
  }

  const hasStartedRun = isLoading || liveSteps.length > 0 || Boolean(taskId);
  const phase = analysis ? "report" : hasStartedRun ? "live" : "input";
  const networkLabel = infraStatus?.network.name === "mainnet" ? "0G Mainnet" : infraStatus?.network.name === "testnet" ? "0G Testnet" : "0G Network";

  return (
    <main className="min-h-screen bg-[var(--cm-background)] text-[var(--cm-text-primary)]">
      <header className="sticky top-0 z-50 flex items-center gap-4 border-b border-[var(--cm-border)] bg-[rgba(10,10,11,0.88)] px-5 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--cm-text-primary)] [font-family:var(--cm-font-mono)] text-sm font-bold text-[var(--cm-background)]">
            C
          </span>
          <span className="text-sm font-semibold">ClawMind</span>
          <span className="[font-family:var(--cm-font-mono)] text-xs text-[var(--cm-text-muted)]">/ analysis</span>
        </Link>

        <div className="ml-auto hidden items-center gap-2 [font-family:var(--cm-font-mono)] text-xs text-[var(--cm-text-muted)] sm:flex">
          <span>{networkLabel}</span>
          <span>·</span>
          <span>{phase}</span>
        </div>

        <nav className="flex items-center gap-2">
          <Link href="/stats" className="rounded-md border border-[var(--cm-border)] px-3 py-2 text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-border-emphasis)] hover:text-[var(--cm-text-primary)]">
            Stats
          </Link>
          <Link href="/judge" className="rounded-md border border-[var(--cm-border)] px-3 py-2 text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-border-emphasis)] hover:text-[var(--cm-text-primary)]">
            Judge
          </Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-[1440px]">
        {phase === "input" ? (
          <InputPhase
            task={task}
            setTask={setTask}
            onRun={runAnalysis}
            isLoading={isLoading}
            requestError={requestError}
          />
        ) : phase === "live" ? (
          <LivePhase
            taskId={taskId}
            steps={analysis?.steps ?? liveSteps}
            currentStep={currentStep}
            elapsedMs={elapsedMs}
            isLoading={isLoading}
            requestError={requestError}
            analysis={analysis}
            onReset={resetRun}
          />
        ) : analysis ? (
          <ReportPhase analysis={analysis} onReset={resetRun} />
        ) : null}
      </div>
    </main>
  );
}
