"use client";

import { useState, useEffect, useCallback } from "react";

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

type JudgeRecentAnalysis = {
  analysisId: number;
  rootHash: string;
  score: number;
  recommendation: string;
  timestamp: number;
  explorerUrl: string;
};

type JudgeAnalysesPerHour = {
  hour: string;
  count: number;
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
  analysisCount: number;
  recentAnalyses: JudgeRecentAnalysis[];
  analysesPerHour: JudgeAnalysesPerHour[];
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

/** Animated refresh icon — spins when `spinning` is true */
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-cyan-400 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

/** Pulsing live indicator dot */
function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mini Bar Chart — Analyses per Hour (last 24h)
// ---------------------------------------------------------------------------

function MiniBarChart({ data }: { data: JudgeAnalysesPerHour[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-[3px] h-28 w-full overflow-x-auto">
      {data.map((d, i) => {
        const heightPct = (d.count / maxCount) * 100;
        const isNow = i === data.length - 1;
        return (
          <div
            key={d.hour}
            className="flex flex-col items-center justify-end min-w-[28px] flex-1"
            style={{ height: "100%" }}
          >
            {/* Count label above bar */}
            <span
              className={`text-[9px] font-mono mb-0.5 ${
                d.count > 0
                  ? "text-cyan-300"
                  : "text-zinc-600"
              }`}
            >
              {d.count > 0 ? d.count : ""}
            </span>
            {/* Bar */}
            <div
              className={`w-full rounded-t transition-all duration-500 ${
                isNow
                  ? "bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
                  : d.count > 0
                    ? "bg-gradient-to-t from-purple-700/80 to-purple-500/80"
                    : "bg-zinc-800"
              }`}
              style={{
                height: `${Math.max(heightPct, 4)}%`,
                minHeight: d.count > 0 ? "6px" : "2px",
              }}
            />
            {/* Hour label below bar */}
            <span
              className={`text-[8px] font-mono mt-1 ${
                isNow ? "text-cyan-300 font-bold" : "text-zinc-600"
              }`}
            >
              {d.hour.replace(":00", "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Judge Page — Live Dashboard
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;

export default function JudgePage() {
  const [data, setData] = useState<JudgeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/judge");
      if (!res.ok) throw new Error("Failed to load judge data");
      const json: JudgeData = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_MS / 1000);
    const tick = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? REFRESH_INTERVAL_MS / 1000 : prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

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
              <div className="mb-3 flex flex-wrap gap-2 items-center">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {data.track}
                </span>
                <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-200">
                  Judge Mode
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <LiveDot />
                  LIVE
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

        {/* ─── Auto-Refresh Indicator ─── */}
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <RefreshIcon spinning={refreshing} />
            <span className="text-xs text-zinc-400">
              {lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : "Connecting..."}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            Auto-refreshing in {countdown}s
          </span>
        </div>

        {/* ─── Total On-Chain Analyses Counter ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-400/20 flex items-center justify-center">
                <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Total On-Chain Analyses</p>
              {data.analysisCount > 0 ? (
                <p className="text-4xl font-black text-white tracking-tight">
                  {data.analysisCount.toLocaleString()}
                </p>
              ) : (
                <p className="text-lg font-semibold text-zinc-400 italic">
                  No analyses on-chain yet
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ─── Mini Chart — Analyses per Hour ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Analyses per Hour (Last 24h)
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Distribution of on-chain analysis registrations across the last 24 hours.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <MiniBarChart data={data.analysesPerHour} />
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded bg-gradient-to-r from-purple-700/80 to-purple-500/80" />
              Historical
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded bg-gradient-to-r from-cyan-600 to-cyan-400" />
              Current hour
            </span>
          </div>
        </section>

        {/* ─── Last 10 Analyses ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h2.25m-2.25 0c-.621 0-1.125.504-1.125 1.125M13.125 12c.621 0 1.125.504 1.125 1.125m-2.25 0v1.5m0-1.5c0 .621-.504 1.125-1.125 1.125m2.25-1.125c0 .621.504 1.125 1.125 1.125" />
              </svg>
              Last 10 On-Chain Analyses
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Most recent analysis records from the AnalysisRegistry contract. Click a row to view on Explorer.
            </p>
          </div>

          {data.recentAnalyses.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recommendation</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Root Hash</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAnalyses.map((a) => (
                    <tr
                      key={a.analysisId}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => window.open(a.explorerUrl, "_blank", "noreferrer")}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-cyan-300">#{a.analysisId}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${
                          a.score >= 80 ? "text-emerald-300" :
                          a.score >= 50 ? "text-amber-300" :
                          "text-red-300"
                        }`}>
                          {a.score}
                        </span>
                        <span className="text-zinc-600">/100</span>
                      </td>
                      <td className="px-4 py-3">
                        <RecommendationBadge value={a.recommendation} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        {shortenHash(a.rootHash, 6)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {new Date(a.timestamp * 1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          View
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-black/20 p-8 text-center">
              <svg className="mx-auto h-10 w-10 text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-zinc-500 text-sm">No on-chain analyses recorded yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Run an analysis to see it appear here.</p>
            </div>
          )}
        </section>

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
          ClawMind Judge Mode — Live monitoring dashboard for hackathon evaluation. No wallet connection required.
        </footer>
      </div>
    </main>
  );
}
