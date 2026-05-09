"use client";

import { MemoryRecord, AnalysisReport } from "@/lib/types";

type MemoryGraphProps = {
  memories: MemoryRecord[];
  currentTask?: string;
  currentReport?: AnalysisReport;
  storageProvider?: string;
};

const AGENT_BADGE_TEXT: Record<string, string> = {
  GO: "text-emerald-200",
  NO_GO: "text-red-200",
  INVESTIGATE_MORE: "text-amber-200",
};

const AGENT_BADGE_BG: Record<string, string> = {
  GO: "border-emerald-400/30 bg-emerald-400/10",
  NO_GO: "border-red-400/30 bg-red-400/10",
  INVESTIGATE_MORE: "border-amber-400/30 bg-amber-400/10",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-emerald-400",
};

function shortenText(text: string, maxLen = 60): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/* -------------------------------------------------------------------------- */
/*  Memory Node — a single retrieved memory card                              */
/* -------------------------------------------------------------------------- */

function MemoryNode({
  memory,
  is0G,
}: {
  memory: MemoryRecord;
  is0G: boolean;
}) {
  const borderClass = is0G
    ? "border-emerald-400/30 hover:border-emerald-400/50"
    : "border-yellow-400/30 hover:border-yellow-400/50";

  const glowClass = is0G
    ? "shadow-emerald-400/5 hover:shadow-emerald-400/10"
    : "shadow-yellow-400/5 hover:shadow-yellow-400/10";

  return (
    <div
      className={`group relative rounded-2xl border ${borderClass} bg-black/30 p-4 shadow-lg ${glowClass} transition-all duration-300`}
    >
      {/* Storage indicator dot */}
      <div className="absolute -left-1.5 top-4 h-3 w-3 rounded-full border border-black/40 shadow-sm"
        style={{ backgroundColor: is0G ? "#34d399" : "#facc15" }}
      />

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-100 leading-snug">
          {shortenText(memory.task, 52)}
        </p>
        <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-bold text-cyan-200">
          {memory.score}
        </span>
      </div>

      {/* Recommendation badge */}
      <div className="mt-2.5 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${AGENT_BADGE_BG[memory.recommendation]} ${AGENT_BADGE_TEXT[memory.recommendation]}`}
        >
          {memory.recommendation.replace("_", " ")}
        </span>
        <span className="text-xs text-zinc-500">
          {is0G ? "0G Storage" : "Local"}
        </span>
      </div>

      {/* Risk severity dots */}
      {memory.risks.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Risks
          </span>
          {memory.risks.slice(0, 5).map((risk, i) => (
            <span
              key={`${memory.id}-risk-${i}`}
              className="h-1.5 w-1.5 rounded-full bg-amber-400"
              title={risk}
            />
          ))}
          {memory.risks.length > 5 && (
            <span className="text-[10px] text-zinc-500">+{memory.risks.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Current Analysis Node — the active output node with cyan glow             */
/* -------------------------------------------------------------------------- */

function CurrentAnalysisNode({
  task,
  report,
}: {
  task: string;
  report?: AnalysisReport;
}) {
  const rec = report?.recommendation ?? "INVESTIGATE_MORE";

  return (
    <div className="relative">
      {/* Animated glow ring */}
      <div className="absolute -inset-1 rounded-[1.1rem] bg-cyan-400/10 blur-md animate-pulse" />

      <div className="relative rounded-2xl border border-cyan-400/40 bg-cyan-400/5 p-5 shadow-xl shadow-cyan-400/10">
        {/* "Active" badge */}
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Current Analysis
          </span>
        </div>

        <p className="text-sm font-bold text-white leading-snug">
          {shortenText(task, 64)}
        </p>

        {report && (
          <>
            {/* Score + Recommendation */}
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-100">
                {report.score}/100
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${AGENT_BADGE_BG[rec]} ${AGENT_BADGE_TEXT[rec]}`}
              >
                {rec.replace("_", " ")}
              </span>
            </div>

            {/* Top risks */}
            {report.risks.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {report.risks.slice(0, 3).map((risk) => (
                  <div key={risk.title} className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_COLORS[risk.severity] ?? "bg-zinc-400"}`}
                    />
                    <span className="text-xs text-zinc-300 truncate">
                      {shortenText(risk.title, 48)}
                    </span>
                  </div>
                ))}
                {report.risks.length > 3 && (
                  <span className="text-[10px] text-zinc-500">
                    +{report.risks.length - 3} more risks
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Legend                                                                     */
/* -------------------------------------------------------------------------- */

function Legend() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Legend
      </span>

      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="text-xs text-zinc-400">0G Storage Memory</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="text-xs text-zinc-400">Local Memory</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
        <span className="text-xs text-zinc-400">Current Analysis</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-emerald-400/40 border border-emerald-400/30" />
        <span className="text-xs text-zinc-400">GO</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-red-400/40 border border-red-400/30" />
        <span className="text-xs text-zinc-400">NO-GO</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-amber-400/40 border border-amber-400/30" />
        <span className="text-xs text-zinc-400">INVESTIGATE</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main MemoryGraph Component                                                */
/* -------------------------------------------------------------------------- */

export function MemoryGraph({
  memories,
  currentTask,
  currentReport,
  storageProvider,
}: MemoryGraphProps) {
  // Empty state — no memories and no current analysis
  const currentStorageLabel = storageProvider === "0G_STORAGE" ? "0G Storage" : "Local";
  if (memories.length === 0 && !currentTask) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">Memory Flow</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Run an analysis to see how past memories influence new decisions.
          </p>
        </div>
        <div className="flex items-center justify-center rounded-2xl border border-white/5 bg-black/20 py-12">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M8 12h8M12 8v8" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No memory connections yet</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">Memory Flow</h2>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
            LIVE
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Visual trace of how retrieved memories flow into the current analysis —
          building cumulative intelligence across sessions.
        </p>
      </div>

      {/* ---- Desktop layout: left → right flow ---- */}
      <div className="hidden lg:flex lg:items-stretch lg:gap-0">
        {/* LEFT COLUMN — Retrieved Memories */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-400">
              {memories.length}
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Retrieved Memories
            </h3>
          </div>

          {memories.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
              <p className="text-xs text-zinc-500">No memories retrieved</p>
              <p className="mt-1 text-[10px] text-zinc-600">First analysis — building memory from scratch</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <MemoryNode
                  key={memory.id}
                  memory={memory}
                  is0G={!!memory.storageUri}
                />
              ))}
            </div>
          )}
        </div>

        {/* CENTER — Arrows */}
        {memories.length > 0 && currentTask && (
          <div className="flex w-16 shrink-0 flex-col justify-stretch">
            <div className="flex h-full items-center">
              <svg
                className="h-full w-full"
                viewBox="0 0 64 300"
                preserveAspectRatio="none"
                fill="none"
              >
                <defs>
                  <linearGradient id="flow-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
                    <stop offset="50%" stopColor="rgba(34,211,238,0.4)" />
                    <stop offset="100%" stopColor="rgba(34,211,238,0.7)" />
                  </linearGradient>
                </defs>
                {/* Converging lines from each memory to center-right */}
                {memories.map((_, i) => {
                  const total = memories.length;
                  const startY = total === 1 ? 150 : 30 + (i / (total - 1)) * 240;
                  return (
                    <line
                      key={`flow-line-${i}`}
                      x1="4"
                      y1={startY}
                      x2="48"
                      y2="150"
                      stroke="url(#flow-grad)"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      opacity={0.7}
                    />
                  );
                })}
                {/* Central converging arrowhead */}
                <polygon
                  points="48,144 58,150 48,156"
                  fill="rgba(34,211,238,0.6)"
                />
                {/* Glow dot at convergence */}
                <circle cx="4" cy="150" r="3" fill="rgba(34,211,238,0.3)" />
              </svg>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN — Current Analysis */}
        {currentTask && (
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-xs font-bold text-cyan-300">
                1
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Current Analysis
              </h3>
            </div>
            <CurrentAnalysisNode task={currentTask} report={currentReport} />
          </div>
        )}
      </div>

      {/* ---- Mobile / Tablet layout: vertical stack ---- */}
      <div className="lg:hidden">
        {/* Retrieved Memories */}
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-400">
            {memories.length}
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Retrieved Memories
          </h3>
        </div>

        {memories.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
            <p className="text-xs text-zinc-500">No memories retrieved</p>
            <p className="mt-1 text-[10px] text-zinc-600">First analysis — building memory from scratch</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <MemoryNode
                key={memory.id}
                memory={memory}
                is0G={!!memory.storageUri}
              />
            ))}
          </div>
        )}

        {/* Flow arrow */}
        {memories.length > 0 && currentTask && (
          <div className="flex items-center justify-center py-3">
            <div className="flex flex-col items-center gap-1">
              {/* Vertical dashed line */}
              <div className="h-6 w-px border-r border-dashed border-cyan-400/30" />
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2v12m0 0l-4-4m4 4l4-4"
                  stroke="rgba(34,211,238,0.5)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[10px] text-cyan-400/60 font-semibold">INFLUENCES</span>
            </div>
          </div>
        )}

        {/* Current Analysis */}
        {currentTask && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-xs font-bold text-cyan-300">
                1
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Current Analysis
              </h3>
            </div>
            <CurrentAnalysisNode task={currentTask} report={currentReport} />
          </>
        )}
      </div>

      {/* Legend */}
      <Legend />

      {/* Memory Stats Footer */}
      {memories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          <StatChip
            label="Memories Used"
            value={memories.length.toString()}
          />
          <StatChip
            label="0G Stored"
            value={memories.filter((m) => !!m.storageUri).length.toString()}
          />
          <StatChip
            label="Local"
            value={memories.filter((m) => !m.storageUri).length.toString()}
          />
          <StatChip
            label="Avg Score"
            value={
              memories.length > 0
                ? Math.round(
                    memories.reduce((sum, m) => sum + m.score, 0) /
                      memories.length
                  ).toString()
                : "—"
            }
          />
          <StatChip
            label="Total Risks"
            value={memories.reduce((sum, m) => sum + m.risks.length, 0).toString()}
          />
          <StatChip
            label="Current Storage"
            value={currentStorageLabel}
          />
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small stat chip                                                           */
/* -------------------------------------------------------------------------- */

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-black/20 px-3 py-1">
      <span className="text-xs font-bold text-zinc-200">{value}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
