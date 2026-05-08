"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types (mirroring the API response)
// ---------------------------------------------------------------------------

type JudgeNetworkInfo = {
  name: "mainnet" | "testnet";
  chainId: number;
  explorerBaseUrl: string;
};

type JudgeComputeInfo = {
  provider: "0G_COMPUTE" | "LOCAL_FALLBACK";
  status: "active" | "fallback";
};

type JudgeStorageInfo = {
  configured: boolean;
  provider: "0G_STORAGE" | "LOCAL_FALLBACK";
  network: string;
};

type JudgeOnChainInfo = {
  configured: boolean;
  contractAddress: string | null;
  explorerUrl: string | null;
  latestAnalysis: Record<string, unknown> | null;
};

type JudgeOpenClawInfo = {
  available: boolean;
  manifestUrl: string;
};

type JudgeIntegrationInfo = {
  compute: JudgeComputeInfo;
  storage: JudgeStorageInfo;
  onChain: JudgeOnChainInfo;
  openClaw: JudgeOpenClawInfo;
};

type JudgeLatestOnChainAnalysis = {
  analysisId: number;
  rootHash: string;
  storageUri: string;
  score: number;
  recommendation: string;
  timestamp: number;
  submitter: string;
  explorerTxUrl: string;
};

type JudgeMemoryStats = {
  totalRecords: number;
  zeroGBackedCount: number;
  sampleMemoryIds: string[];
};

type JudgeData = {
  projectName: string;
  track: string;
  description: string;
  network: JudgeNetworkInfo;
  integration: JudgeIntegrationInfo;
  latestOnChainAnalysis: JudgeLatestOnChainAnalysis | null;
  memory: JudgeMemoryStats;
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        ok
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          ok ? "bg-emerald-400" : "bg-yellow-400"
        }`}
      />
      {label}
    </span>
  );
}

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-cyan-300 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-cyan-200"
    >
      {children}
    </a>
  );
}

function shortenHash(value: string, chars = 8): string {
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
}

function RecommendationBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    GO: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    NO_GO: "border-red-400/40 bg-red-400/10 text-red-200",
    INVESTIGATE_MORE: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  };

  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${
        styles[value] ?? "border-zinc-400/40 bg-zinc-400/10 text-zinc-200"
      }`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Judge Page
// ---------------------------------------------------------------------------

export default function JudgePage() {
  const [data, setData] = useState<JudgeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/judge")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load judge data");
        return res.json();
      })
      .then((json: JudgeData) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 mx-auto animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-zinc-400 text-sm">Loading judge review data...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-8 max-w-md text-center">
          <p className="text-red-200 font-semibold">Failed to load judge data</p>
          <p className="text-red-300/70 text-sm mt-2">{error}</p>
        </div>
      </main>
    );
  }

  const ig = data.integration;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.10),_transparent_30%)]" />

      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 space-y-6">
        {/* ─── Header ─── */}
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {data.track}
                </span>
                <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-200">
                  Judge Mode
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {data.projectName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                {data.description}
              </p>
            </div>

            <div className="flex flex-col gap-1 text-sm text-zinc-400">
              <p>
                <span className="text-zinc-200">Network:</span>{" "}
                <span className={data.network.name === "mainnet" ? "text-emerald-300 font-semibold" : "text-yellow-300"}>
                  {data.network.name.toUpperCase()}
                </span>
                <span className="text-zinc-500 ml-1">(Chain {data.network.chainId})</span>
              </p>
              <p>
                <span className="text-zinc-200">Explorer:</span>{" "}
                <ExplorerLink href={data.network.explorerBaseUrl}>
                  {data.network.explorerBaseUrl.replace("https://", "")}
                </ExplorerLink>
              </p>
              <p>
                <span className="text-zinc-200">Generated:</span>{" "}
                {new Date(data.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </header>

        {/* ─── 0G Integration Evidence ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              0G Integration Evidence
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Verifiable proof points for each 0G component used in this project.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* 0G Compute */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">0G Compute</p>
              <p className="text-sm font-semibold text-white mb-2">Agent inference layer</p>
              <StatusBadge ok={ig.compute.status === "active"} label={ig.compute.status === "active" ? "Active" : "Fallback"} />
            </div>

            {/* 0G Storage */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">0G Storage</p>
              <p className="text-sm font-semibold text-white mb-2">Report &amp; memory persistence</p>
              <StatusBadge ok={ig.storage.configured} label={ig.storage.provider} />
              {ig.storage.configured && (
                <p className="mt-2 text-xs text-zinc-500">Network: {ig.storage.network}</p>
              )}
            </div>

            {/* On-Chain Registry */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">0G Chain (AnalysisRegistry)</p>
              <p className="text-sm font-semibold text-white mb-2">On-chain report anchoring</p>
              <StatusBadge ok={ig.onChain.configured} label={ig.onChain.configured ? "Active" : "Not Configured"} />
              {ig.onChain.contractAddress && (
                <div className="mt-2">
                  <p className="text-xs text-zinc-500 mb-1">Contract:</p>
                  {ig.onChain.explorerUrl ? (
                    <ExplorerLink href={ig.onChain.explorerUrl}>
                      {shortenHash(ig.onChain.contractAddress, 10)}
                    </ExplorerLink>
                  ) : (
                    <p className="font-mono text-xs text-cyan-300">{shortenHash(ig.onChain.contractAddress, 10)}</p>
                  )}
                </div>
              )}
            </div>

            {/* OpenClaw */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">OpenClaw Manifest</p>
              <p className="text-sm font-semibold text-white mb-2">Orchestration metadata</p>
              <StatusBadge ok={ig.openClaw.available} label={ig.openClaw.available ? "Available" : "Missing"} />
              {ig.openClaw.available && (
                <div className="mt-2">
                  <ExplorerLink href={ig.openClaw.manifestUrl}>
                    {ig.openClaw.manifestUrl}
                  </ExplorerLink>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Latest On-Chain Analysis ─── */}
        {data.latestOnChainAnalysis && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Latest On-Chain Analysis
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                The most recent analysis registered on the AnalysisRegistry contract.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-zinc-500">Analysis #{data.latestOnChainAnalysis.analysisId}</span>
                <RecommendationBadge value={data.latestOnChainAnalysis.recommendation} />
                <span className="text-sm text-zinc-300">
                  Score: <span className="font-bold text-white">{data.latestOnChainAnalysis.score}/100</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Root Hash</p>
                  <p className="font-mono text-xs text-cyan-300 break-all">{data.latestOnChainAnalysis.rootHash}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Storage URI</p>
                  <p className="font-mono text-xs text-cyan-300 break-all">{data.latestOnChainAnalysis.storageUri}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Submitter</p>
                  <p className="font-mono text-xs text-cyan-300">{shortenHash(data.latestOnChainAnalysis.submitter, 10)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Timestamp</p>
                  <p className="text-xs text-zinc-300">
                    {new Date(data.latestOnChainAnalysis.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
              </div>

              {data.latestOnChainAnalysis.explorerTxUrl && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-xs text-zinc-500 mb-1">View Contract on 0G Explorer</p>
                  <ExplorerLink href={data.latestOnChainAnalysis.explorerTxUrl}>
                    {data.latestOnChainAnalysis.explorerTxUrl.replace("https://", "")}
                  </ExplorerLink>
                  <p className="text-xs text-zinc-600 mt-1">
                    All analysis registration transactions are visible under the contract address.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── Memory Evidence ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Persistent Memory
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              ClawMind reuses prior analysis context through persistent memory stored on 0G Storage.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-2xl font-bold text-white">{data.memory.totalRecords}</p>
              <p className="text-xs text-zinc-500 mt-1">Total Memory Records</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-300">{data.memory.zeroGBackedCount}</p>
              <p className="text-xs text-zinc-500 mt-1">0G Storage-Backed</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-2xl font-bold text-cyan-300">{data.memory.totalRecords - data.memory.zeroGBackedCount}</p>
              <p className="text-xs text-zinc-500 mt-1">Local / Seed Memories</p>
            </div>
          </div>
        </section>

        {/* ─── Track 1 Alignment ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Track 1 Alignment</h2>
            <p className="mt-1 text-sm text-zinc-400">
              How ClawMind meets each priority requirement for Track 1: Agentic Infrastructure &amp; OpenClaw Lab.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                req: "OpenClaw for orchestration",
                met: ig.openClaw.available,
                detail: "openclaw.yaml defines the full multi-agent pipeline, skills, artifacts, and security policies.",
              },
              {
                req: "0G Compute for inference",
                met: ig.compute.status === "active",
                detail: "All 7 specialized agents use 0G Compute-compatible inference endpoint.",
              },
              {
                req: "0G Storage for state persistence",
                met: ig.storage.configured,
                detail: "Decision reports and memory indexes are persisted to 0G Storage with verifiable receipts.",
              },
              {
                req: "0G Storage for long-context memory",
                met: data.memory.zeroGBackedCount > 0,
                detail: `Memory index with ${data.memory.zeroGBackedCount} 0G-backed records, retrievable by 0g:// URI.`,
              },
              {
                req: "On-chain anchoring (0G Chain)",
                met: ig.onChain.configured,
                detail: "AnalysisRegistry.sol registers each analysis on-chain with root hash, score, and recommendation.",
              },
              {
                req: "Multi-agent reasoning pipeline",
                met: true,
                detail: "8-step pipeline: Memory → Planner → Researcher → Risk → Architect → Critic → Final → Memory Writer.",
              },
            ].map((item) => (
              <div
                key={item.req}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mt-0.5">
                  <StatusBadge ok={item.met} label={item.met ? "Covered" : "Pending"} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.req}</p>
                  <p className="text-xs text-zinc-400 mt-1">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Quick Links ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-bold text-white mb-4">Quick Links for Judges</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
            >
              Main App
            </a>
            <a
              href="/api/openclaw/manifest"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-purple-400/20 bg-purple-400/5 px-5 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-400/10"
            >
              OpenClaw Manifest
            </a>
            <a
              href="/api/judge"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/10"
            >
              Judge API (JSON)
            </a>
            <a
              href={data.network.explorerBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              0G Explorer
            </a>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="text-center text-xs text-zinc-600 pb-4">
          ClawMind Judge Mode — Read-only review surface for hackathon evaluation. No wallet connection required.
        </footer>
      </div>
    </main>
  );
}
