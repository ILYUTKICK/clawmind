import { MemoryRecord } from "@/lib/types";

type MemoryPanelProps = {
  memories: MemoryRecord[];
};

export function MemoryPanel({ memories }: MemoryPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Relevant Memories Used
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Retrieved via embedding-based semantic similarity (all-MiniLM-L6-v2).
          Higher similarity = more relevant to current task.
        </p>
      </div>

      {memories.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
          No memory records used yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {memories.map((memory) => (
            <article
              key={memory.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">
                    {memory.task}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {memory.summary}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Similarity score badge — key differentiator */}
                  {memory.similarityScore !== undefined && (
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      memory.similarityScore >= 0.7
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : memory.similarityScore >= 0.4
                        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                        : "border-zinc-400/30 bg-zinc-400/10 text-zinc-300"
                    }`}>
                      {(memory.similarityScore * 100).toFixed(0)}% match
                    </span>
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

              <div className="mt-3 flex items-center gap-3">
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
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
