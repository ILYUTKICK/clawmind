import { AnalysisResult } from "@/lib/types";

type SystemStatusProps = {
  analysis?: AnalysisResult | null;
};

type StatusTone = "active" | "ready" | "fallback";

type StatusItem = {
  eyebrow: string;
  label: string;
  badge: string;
  tone: StatusTone;
};

function badgeClass(tone: StatusTone): string {
  if (tone === "active") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (tone === "ready") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }

  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
}

export function SystemStatus({ analysis }: SystemStatusProps) {
  const hasAnalysis = Boolean(analysis);
  const hasStorageReceipt = analysis?.receipt.provider === "0G_STORAGE";
  const hasMemoryIndexReceipt =
    analysis?.memoryIndexReceipt?.provider === "0G_STORAGE";

  const items: StatusItem[] = [
    {
      eyebrow: "0G COMPUTE",
      label: "Agent inference layer",
      badge: hasAnalysis ? "Active" : "Ready",
      tone: hasAnalysis ? "active" : "ready",
    },
    {
      eyebrow: "0G STORAGE",
      label: hasStorageReceipt ? "Report persistence" : "Report persistence",
      badge: hasStorageReceipt ? "Active" : "Ready",
      tone: hasStorageReceipt ? "active" : "ready",
    },
    {
      eyebrow: "MEMORY",
      label: hasMemoryIndexReceipt ? "0G memory index" : "Memory index",
      badge: hasMemoryIndexReceipt ? "Active" : "Ready",
      tone: hasMemoryIndexReceipt ? "active" : "ready",
    },
    {
      eyebrow: "RETRIEVAL",
      label: "Root hash retrieval",
      badge: "Ready",
      tone: "ready",
    },
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">System Status</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Live infrastructure status for the ClawMind agentic pipeline.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.eyebrow}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {item.eyebrow}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-100">
                {item.label}
              </p>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                  item.tone
                )}`}
              >
                {item.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}