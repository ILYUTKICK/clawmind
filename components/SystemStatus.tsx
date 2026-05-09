import { AnalysisResult } from "@/lib/types";
import type { InfrastructureStatus } from "@/lib/infrastructure-status";

type SystemStatusProps = {
  analysis?: AnalysisResult | null;
  infraStatus?: InfrastructureStatus | null;
};

type StatusTone = "active" | "ready" | "fallback";

type StatusItem = {
  eyebrow: string;
  label: string;
  badge: string;
  tone: StatusTone;
  detail?: string;
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

export function SystemStatus({ analysis, infraStatus }: SystemStatusProps) {
  const hasAnalysis = Boolean(analysis);
  const hasStorageReceipt = analysis?.receipt.provider === "0G_STORAGE";
  const hasMemoryIndexReceipt =
    analysis?.memoryIndexReceipt?.provider === "0G_STORAGE";

  // Use real infrastructure status when available, otherwise fall back to
  // receipt-based detection (which only works after an analysis run).
  const computeActive = infraStatus ? infraStatus.compute.isConfigured : hasAnalysis;
  const storageActive = infraStatus ? infraStatus.storage.isConfigured : hasStorageReceipt;
  const memoryActive = hasMemoryIndexReceipt;
  const onChainActive = infraStatus ? infraStatus.onChain.configured : false;

  const items: StatusItem[] = [
    {
      eyebrow: "0G COMPUTE",
      label: computeActive ? "Agent inference layer" : "Local fallback (no 0G key)",
      badge: computeActive ? "Active" : "Fallback",
      tone: computeActive ? "active" : "fallback",
      detail: computeActive
        ? "All 7 agents use 0G Compute endpoint"
        : "Set ZERO_G_COMPUTE_ENDPOINT + API_KEY to activate",
    },
    {
      eyebrow: "0G STORAGE",
      label: storageActive ? "Report persistence" : "Local fallback (no 0G key)",
      badge: storageActive ? "Active" : "Fallback",
      tone: storageActive ? "active" : "fallback",
      detail: storageActive
        ? `Connected to ${infraStatus?.storage.network ?? "0G"} storage`
        : "Set ZERO_G_STORAGE_ENABLED=true + PRIVATE_KEY to activate",
    },
    {
      eyebrow: "MEMORY",
      label: memoryActive ? "0G memory index" : "Memory index",
      badge: memoryActive ? "Active" : "Ready",
      tone: memoryActive ? "active" : "ready",
      detail: "Long-context memory for cross-analysis reasoning",
    },
    {
      eyebrow: "ON-CHAIN",
      label: onChainActive ? "AnalysisRegistry" : "Contract not deployed",
      badge: onChainActive ? "Active" : "Ready",
      tone: onChainActive ? "active" : "ready",
      detail: onChainActive
        ? `Chain ID ${infraStatus?.network.chainId}`
        : "Deploy AnalysisRegistry.sol to activate",
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
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">
                  {item.label}
                </p>
                {item.detail && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {item.detail}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
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
