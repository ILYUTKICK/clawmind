import { AnalysisResult } from "@/lib/types";

type InfrastructureEvidenceProps = {
  analysis: AnalysisResult | null;
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

function getStatusLabel(value: boolean): string {
  return value ? "Verified" : "Waiting";
}

function isZeroGStorageProvider(provider: string): boolean {
  return provider === "OG_STORAGE" || provider === "0G_STORAGE";
}

export function InfrastructureEvidence({ analysis }: InfrastructureEvidenceProps) {
    const hasAnalysis = analysis !== null;

    const reportProvider = analysis?.receipt?.provider ?? "Waiting for analysis";
    const memoryProvider = analysis?.memoryIndexReceipt?.provider ?? "Waiting for analysis";
    const reportMode = getReportGenerationMode(analysis);

    const hasReportStorage = isZeroGStorageProvider(String(reportProvider));
    const hasMemoryStorage = isZeroGStorageProvider(String(memoryProvider));
    const hasModelJson = reportMode === "MODEL_JSON";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Infrastructure Evidence</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Live proof points for 0G Compute, 0G Storage, OpenClaw, and structured agent output.
          </p>
        </div>

        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
          {hasAnalysis ? "Live Run" : "Pending"}
        </span>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">0G Compute</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Agent inference layer</p>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              Active
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Report Storage</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{reportProvider}</p>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              {getStatusLabel(hasReportStorage)}
            </span>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-cyan-200">
            {shortenHash(analysis?.receipt.reportHash)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Memory Index Storage</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{memoryProvider}</p>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              {getStatusLabel(hasMemoryStorage)}
            </span>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-cyan-200">
            {shortenHash(analysis?.memoryIndexReceipt?.reportHash)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Structured Output</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{reportMode}</p>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              {getStatusLabel(hasModelJson)}
            </span>
          </div>
        </div>

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