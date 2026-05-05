type TrackFitItem = {
  title: string;
  description: string;
};

const trackFitItems: TrackFitItem[] = [
  {
    title: "Cognitive Backbone",
    description: "Multi-agent decision engine for Web3/AI analysis.",
  },
  {
    title: "Orchestration Layer",
    description: "Planner, Researcher, Risk, Architect, Critic, Final Agent.",
  },
  {
    title: "Specialized Skills",
    description: "Risk analysis, architecture design, critique, memory writing.",
  },
  {
    title: "0G Compute",
    description: "Shared inference abstraction for agent calls.",
  },
  {
    title: "0G Storage",
    description: "Persistent report upload with root hash receipt.",
  },
  {
    title: "Long-context Memory",
    description: "Generated memories are reused in future analysis runs.",
  },
];

export function TrackFitPanel() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Track 1 Fit
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Built for Agentic Infrastructure & OpenClaw Lab.
        </p>
      </div>

      <div className="grid gap-3">
        {trackFitItems.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {item.description}
                </p>
              </div>

              <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Covered
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}