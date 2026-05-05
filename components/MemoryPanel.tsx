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
          These records simulate persistent long-context memory. Next step:
          store and retrieve them through 0G Storage.
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
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {memory.task}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {memory.summary}
                  </p>
                </div>

                <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {memory.score}/100
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

              {memory.storageUri ? (
                <p className="mt-4 break-all text-xs text-zinc-500">
                  Storage: {memory.storageUri}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}