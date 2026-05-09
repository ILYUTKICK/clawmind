import { AnalysisResult } from "@/lib/types";
import type { InfrastructureStatus } from "@/lib/infrastructure-status";

type InfrastructureEvidenceProps = {
  analysis: AnalysisResult | null;
  infraStatus?: InfrastructureStatus | null;
};

function getReportGenerationMode(analysis: AnalysisResult | null): string {
  const evidence = analysis?.report.evidence ?? [];
  const modeLine = evidence.find((item) =>
    item.toLowerCase().includes("report generation mode"),
  );

  if (!modeLine) {
    return "Waiting for analysis";
  }

  return modeLine.replace("Report generation mode:", "").replace(".", "").trim();
}

function shortenHash(value?: string): string {
  if (!value) {
    return "Not available";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function isZeroGStorageProvider(provider: string): boolean {
  return provider === "OG_STORAGE" || provider === "0G_STORAGE";
}

export function InfrastructureEvidence({ analysis, infraStatus }: InfrastructureEvidenceProps) {
  const hasAnalysis = analysis !== null;

  const reportProvider = analysis?.receipt?.provider ?? "Waiting for analysis";
  const memoryProvider = analysis?.memoryIndexReceipt?.provider ?? "Waiting for analysis";
  const reportMode = getReportGenerationMode(analysis);

  // Use real infrastructure status when available — NEVER assume configured
  const computeActive = infraStatus?.compute.isConfigured ?? false;
  const storageConfigured = infraStatus?.storage.isConfigured ?? isZeroGStorageProvider(String(reportProvider));
  // Memory Index uses the same 0G Storage as Report Storage — check infraStatus first
  const memoryConfigured = infraStatus?.storage.isConfigured ?? isZeroGStorageProvider(String(memoryProvider));
  const onChainConfigured = infraStatus?.onChain.configured ?? false;
  const hasContractAddress = Boolean(infraStatus?.onChain.contractAddress);
  const hasModelJson = reportMode === "MODEL_JSON";

  // Network label
  const networkName = infraStatus?.network.name;
  const isMainnet = networkName === "mainnet";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Infrastructure Evidence</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Live proof points for 0G Compute, 0G Storage, OpenClaw, and structured agent output.
          </p>
        </div>

        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          hasAnalysis
            ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
            : "border-zinc-400/30 bg-zinc-400/10 text-zinc-300"
        }`}>
          {hasAnalysis ? "Live Run" : "Pending"}
        </span>
      </div>

      <div className="grid gap-3">
        {/* 0G Compute */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">0G Compute</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Agent inference layer</p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              computeActive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
            }`}>
              {computeActive ? "Active" : "Fallback"}
            </span>
          </div>
        </div>

        {/* Report Storage */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Report Storage</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              {hasAnalysis ? reportProvider : (storageConfigured ? "0G Storage" : "Local Fallback")}
            </p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              storageConfigured
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
            }`}>
              {hasAnalysis
                ? (storageConfigured ? "0G Verified" : "Fallback (no key)")
                : (storageConfigured ? "Ready" : "Not Configured")
              }
            </span>
          </div>
          {analysis?.receipt?.reportHash && (
            <p className="mt-2 break-all font-mono text-xs text-cyan-200">
              {shortenHash(analysis.receipt.reportHash)}
            </p>
          )}
          {!storageConfigured && !hasAnalysis && (
            <p className="mt-1 text-xs text-yellow-300/70">
              Set ZERO_G_STORAGE_ENABLED=true + ZERO_G_STORAGE_PRIVATE_KEY
            </p>
          )}
        </div>

        {/* Memory Index Storage */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Memory Index Storage</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              {hasAnalysis ? memoryProvider : (memoryConfigured ? "0G Storage" : "Local Fallback")}
            </p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              memoryConfigured
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
            }`}>
              {hasAnalysis
                ? (memoryConfigured ? "0G Verified" : "Fallback (no key)")
                : (memoryConfigured ? "Ready" : "Not Configured")
              }
            </span>
          </div>
          {analysis?.memoryIndexReceipt?.reportHash && (
            <p className="mt-2 break-all font-mono text-xs text-cyan-200">
              {shortenHash(analysis.memoryIndexReceipt.reportHash)}
            </p>
          )}
          {!memoryConfigured && !hasAnalysis && (
            <p className="mt-1 text-xs text-yellow-300/70">
              Set ZERO_G_STORAGE_ENABLED=true + ZERO_G_STORAGE_PRIVATE_KEY
            </p>
          )}
        </div>

        {/* On-Chain Registry */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">On-Chain Registry</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">
                {hasContractAddress ? "AnalysisRegistry" : "Not Deployed"}
              </p>
              {isMainnet && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  MAINNET
                </span>
              )}
              {!isMainnet && hasContractAddress && (
                <span className="rounded-full border border-yellow-400/20 bg-yellow-400/5 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300">
                  {networkName?.toUpperCase() ?? "UNKNOWN"}
                </span>
              )}
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              onChainConfigured
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-red-400/30 bg-red-400/10 text-red-200"
            }`}>
              {onChainConfigured ? "Active" : "No Private Key"}
            </span>
          </div>
          {infraStatus?.onChain.contractAddress && (
            <div className="mt-2 flex items-center gap-2">
              <p className="font-mono text-xs text-cyan-200">
                {shortenHash(infraStatus.onChain.contractAddress)}
              </p>
              {infraStatus.onChain.explorerUrl && (
                <a
                  href={infraStatus.onChain.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-purple-300 underline decoration-purple-400/40 underline-offset-4 hover:text-purple-200"
                >
                  Explorer
                </a>
              )}
            </div>
          )}
          {!onChainConfigured && (
            <p className="mt-1 text-xs text-red-300/70">
              Set ZERO_G_STORAGE_PRIVATE_KEY + ZERO_G_NETWORK=mainnet to send on-chain tx
            </p>
          )}
        </div>

        {/* Structured Output */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Structured Output</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{reportMode}</p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              hasModelJson
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
            }`}>
              {hasModelJson ? "Verified" : "Waiting"}
            </span>
          </div>
        </div>

        {/* OpenClaw Manifest */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">OpenClaw Manifest</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <a
              href="/api/openclaw/manifest"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-cyan-100 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-cyan-200"
            >
              /api/openclaw/manifest
            </a>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              Available
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
