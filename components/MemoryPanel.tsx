"use client";

import { useEffect, useMemo, useState } from "react";
import { MemoryRecord } from "@/lib/types";

type MemoryPanelProps = {
  memories: MemoryRecord[];
};

type MemoryStats = {
  totalRecords: number;
  runtimeGeneratedCount: number;
  seedCount: number;
};

function getSimilarityColor(score: number): string {
  if (score >= 0.7) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (score >= 0.4) return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-zinc-400/30 bg-zinc-400/10 text-zinc-300";
}

function getSimilarityLabel(score: number): string {
  if (score >= 0.85) return "Strong match";
  if (score >= 0.7) return "High match";
  if (score >= 0.5) return "Moderate match";
  if (score >= 0.3) return "Weak match";
  return "Low match";
}

export function MemoryPanel({ memories }: MemoryPanelProps) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const retrievedCounts = useMemo(() => {
    return memories.reduce(
      (acc, memory) => {
        if (memory.id.startsWith("mem_generated_")) {
          acc.runtime += 1;
        } else {
          acc.seed += 1;
        }

        return acc;
      },
      { seed: 0, runtime: 0 },
    );
  }, [memories]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/judge")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.memory) {
          setMemoryStats({
            totalRecords: data.memory.totalRecords,
            runtimeGeneratedCount: data.memory.runtimeGeneratedCount,
            seedCount: data.memory.seedCount,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase text-[var(--cm-text-muted)]">Persistent Memory</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--cm-text-primary)]">
            Memory retrieved for this task
          </h2>
          <p className="mt-1 text-sm text-[var(--cm-text-muted)]">
            Embedding-based semantic similarity over the 0G-backed memory index.
          </p>
        </div>
        <div className="grid gap-2 font-mono text-xs text-zinc-300 sm:grid-cols-3 lg:min-w-[360px]">
          <div className="rounded-lg border border-[var(--cm-border)] px-3 py-2">
            <p className="text-[var(--cm-text-muted)]">retrieved</p>
            <p className="mt-1 text-base text-[var(--cm-text-primary)]">{memories.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--cm-border)] px-3 py-2">
            <p className="text-[var(--cm-text-muted)]">runtime</p>
            <p className="mt-1 text-base text-[var(--cm-accent)]">{retrievedCounts.runtime}</p>
          </div>
          <div className="rounded-lg border border-[var(--cm-border)] px-3 py-2">
            <p className="text-[var(--cm-text-muted)]">total</p>
            <p className="mt-1 text-base text-[var(--cm-text-primary)]">
              {memoryStats
                ? `${memoryStats.seedCount} seed + ${memoryStats.runtimeGeneratedCount} runtime = ${memoryStats.totalRecords}`
                : `${retrievedCounts.seed} seed + ${retrievedCounts.runtime} runtime`}
            </p>
          </div>
        </div>
      </div>

      {memories.length === 0 ? (
        <div className="rounded-lg border border-[var(--cm-border)] bg-black/20 p-4 text-sm text-[var(--cm-text-muted)]">
          No memory records used yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {memories.map((memory) => {
            const hasSimilarity = memory.similarityScore !== undefined && memory.similarityScore > 0;
            const similarityPct = hasSimilarity
              ? (memory.similarityScore! * 100).toFixed(0)
              : null;
            const similarityDec = hasSimilarity
              ? memory.similarityScore!.toFixed(2)
              : null;

            return (
              <article
                key={memory.id}
                className="rounded-lg border border-[var(--cm-border)] bg-black/20 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-100">
                        {memory.task}
                      </p>
                      {/* Memory ID badge */}
                      <span className="inline-flex items-center rounded border border-white/5 bg-white/[0.03] px-1.5 py-px text-[8px] font-mono text-zinc-600">
                        {memory.id}
                      </span>
                      <span className="inline-flex items-center rounded border border-[var(--cm-border)] bg-white/[0.03] px-1.5 py-px text-[8px] font-mono text-[var(--cm-text-muted)]">
                        {memory.id.startsWith("mem_generated_") ? "runtime" : "seed"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {memory.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {/* Similarity score badge — with detailed label */}
                    {hasSimilarity && similarityPct && similarityDec && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSimilarityColor(memory.similarityScore!)}`}>
                          {similarityPct}% match
                        </span>
                        <span className="text-[9px] font-mono text-zinc-600">
                          {getSimilarityLabel(memory.similarityScore!)} (cos={similarityDec})
                        </span>
                      </div>
                    )}
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                      {memory.score}/100
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {memory.risks.map((risk) => (
                    <span
                      key={`${memory.id}-${risk}`}
                      className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100"
                    >
                      {risk}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {memory.storageUri ? (
                    <p className="break-all text-xs text-zinc-500">
                      Storage: {memory.storageUri}
                    </p>
                  ) : null}
                  {memory.embedding && memory.embedding.length > 0 && (
                    <span className="rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono text-zinc-600">
                      emb:{memory.embedding.length}d
                    </span>
                  )}
                  {memory.recommendation && (
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${
                      memory.recommendation === "GO"
                        ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
                        : memory.recommendation === "NO_GO"
                        ? "border-red-400/20 bg-red-400/5 text-red-300"
                        : "border-amber-400/20 bg-amber-400/5 text-amber-300"
                    }`}>
                      {memory.recommendation}
                    </span>
                  )}
                </div>

                {/* Similarity detail line — "Memory mem_023 matched (0.87 similarity)" */}
                {hasSimilarity && similarityDec && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-cyan-400/50">
                      <circle cx="5" cy="5" r="4" fill="currentColor" />
                    </svg>
                    <span className="text-[10px] font-mono text-cyan-400/70">
                      Memory {memory.id} matched ({similarityDec} cosine similarity)
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Embedding info footer */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
        <span className="text-[10px] text-zinc-600">
          Embedding model: all-MiniLM-L6-v2 (384 dimensions)
        </span>
        <span className="text-[10px] text-zinc-600">
          Retrieval: cosine similarity top-k
        </span>
        <span className="text-[10px] text-zinc-600">
          Storage: 0G Storage (versioned, immutable snapshots)
        </span>
      </div>
    </section>
  );
}
