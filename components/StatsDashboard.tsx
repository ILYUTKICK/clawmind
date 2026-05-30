"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Recommendation = "GO" | "NO_GO" | "INVESTIGATE_MORE";
type AnalysisSource = "web" | "mcp";

type JudgeRecentAnalysis = {
  analysisId: number;
  rootHash: string;
  score: number;
  recommendation: Recommendation;
  timestamp: number;
  explorerUrl: string;
};

type JudgeAnalysisMetric = {
  taskId: string;
  source: AnalysisSource;
  score: number;
  recommendation: Recommendation;
  timestamp: number;
  analysisId?: number;
  rootHash?: string;
  txHash?: string;
  signatureVerified?: boolean;
  criticTotalChallenges: number;
  criticResolvedChallenges: number;
  criticUnresolvedChallenges: number;
  criticPenalty: number;
};

export type StatsJudgeData = {
  projectName: string;
  track: string;
  network: {
    name: "mainnet" | "testnet";
    chainId: number;
    explorerBaseUrl: string;
  };
  integration: {
    onChain: {
      contractAddress: string | null;
      explorerUrl: string | null;
      operatorAuthentication: {
        mode: string;
        contractSupportsOperatorAuth: boolean;
        operatorAddress: string | null;
        operatorAuthorized: boolean | null;
        signatureVerified: boolean;
      };
    };
  };
  latestOnChainAnalysis: {
    analysisId: number;
    rootHash: string;
    storageUri: string;
    score: number;
    recommendation: Recommendation;
    timestamp: number;
    submitter: string;
    explorerTxUrl: string;
    taskHash?: string;
    signature?: string;
    signatureVerified?: boolean;
    registryMode?: "SIGNED_OPERATOR" | "LEGACY_UNAUTHENTICATED";
  } | null;
  analysisCount: number;
  recentAnalyses: JudgeRecentAnalysis[];
  analysesPerHour: Array<{
    hour: string;
    count: number;
  }>;
  scoreDistribution: Record<Recommendation, number>;
  criticEffectiveness: {
    sampleSize: number;
    totalChallenges: number;
    resolvedChallenges: number;
    unresolvedChallenges: number;
    averageChallenges: number;
    averagePenalty: number;
  };
  mcpUsage: {
    trackedAnalyses: number;
    mcpInitiatedAnalyses: number;
    webInitiatedAnalyses: number;
  };
  analysisMetricsRecent?: JudgeAnalysisMetric[];
  memory: {
    totalRecords: number;
    zeroGBackedCount: number;
    runtimeGeneratedCount: number;
    seedCount: number;
    sampleMemoryIds: string[];
    latestMemoryIndexUri: string | null;
    semanticRetrievalActive: boolean;
    semanticRetrievalExample: string | null;
  };
  generatedAt: string;
};

type StatsDashboardProps = {
  data: StatsJudgeData | null;
  version: string;
  buildHash: string;
};

type FeedRow = {
  analysisId: number;
  rootHash: string;
  score: number;
  recommendation: Recommendation;
  timestamp: number;
  explorerUrl: string;
  txHash?: string;
  txUrl?: string;
  source: AnalysisSource | "registry";
  signed: boolean;
  taskId?: string;
  criticTotalChallenges?: number;
  criticUnresolvedChallenges?: number;
  criticPenalty?: number;
};

const REFRESH_INTERVAL_MS = 60_000;
const MCP_ENDPOINT = "https://clawmind-mcp.vercel.app/sse";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function shortHash(value?: string | null, head = 10, tail = 6): string {
  if (!value) return "not available";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatAge(timestamp: number, nowMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestamp * 1_000) / 1_000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatGeneratedAt(iso?: string): string {
  if (!iso) return "not available";

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function recommendationTone(recommendation: Recommendation) {
  if (recommendation === "GO") {
    return {
      badge: "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200",
      dot: "bg-[var(--cm-accent)]",
      bar: "bg-[var(--cm-accent)]",
      text: "text-[var(--cm-accent)]",
    };
  }

  if (recommendation === "NO_GO") {
    return {
      badge: "border-[var(--cm-critical)] bg-[var(--cm-critical)]/10 text-red-200",
      dot: "bg-[var(--cm-critical)]",
      bar: "bg-[var(--cm-critical)]",
      text: "text-[var(--cm-critical)]",
    };
  }

  return {
    badge: "border-[var(--cm-warning)] bg-[var(--cm-warning)]/10 text-amber-200",
    dot: "bg-[var(--cm-warning)]",
    bar: "bg-[var(--cm-warning)]",
    text: "text-[var(--cm-warning)]",
  };
}

function sourceTone(source: FeedRow["source"]): string {
  if (source === "mcp") {
    return "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200";
  }

  if (source === "web") {
    return "border-[var(--cm-border-emphasis)] bg-white/[0.03] text-zinc-200";
  }

  return "border-[var(--cm-border)] bg-black/20 text-[var(--cm-text-muted)]";
}

function getExplorerTxUrl(explorerBaseUrl: string, txHash?: string): string | undefined {
  if (!txHash) return undefined;
  return `${explorerBaseUrl.replace(/\/+$/, "")}/tx/${txHash}`;
}

function buildFeedRows(data: StatsJudgeData | null): FeedRow[] {
  if (!data) return [];

  const metrics = data.analysisMetricsRecent ?? [];
  const metricsById = new Map<number, JudgeAnalysisMetric>();
  const metricsByRootHash = new Map<string, JudgeAnalysisMetric>();

  for (const metric of metrics) {
    if (typeof metric.analysisId === "number" && metric.analysisId > 0) {
      metricsById.set(metric.analysisId, metric);
    }

    if (metric.rootHash) {
      metricsByRootHash.set(metric.rootHash, metric);
    }
  }

  const rows = data.recentAnalyses.map((analysis): FeedRow => {
    const metric =
      metricsById.get(analysis.analysisId) ??
      metricsByRootHash.get(analysis.rootHash);
    const txUrl = getExplorerTxUrl(data.network.explorerBaseUrl, metric?.txHash);

    return {
      analysisId: analysis.analysisId,
      rootHash: analysis.rootHash,
      score: analysis.score,
      recommendation: analysis.recommendation,
      timestamp: analysis.timestamp,
      explorerUrl: analysis.explorerUrl,
      txHash: metric?.txHash,
      txUrl,
      source: metric?.source ?? "registry",
      signed:
        metric?.signatureVerified ??
        data.latestOnChainAnalysis?.signatureVerified ??
        data.integration.onChain.operatorAuthentication.signatureVerified,
      taskId: metric?.taskId,
      criticTotalChallenges: metric?.criticTotalChallenges,
      criticUnresolvedChallenges: metric?.criticUnresolvedChallenges,
      criticPenalty: metric?.criticPenalty,
    };
  });

  if (rows.length > 0) return rows;

  return metrics.map((metric, index): FeedRow => {
    const txUrl = getExplorerTxUrl(data.network.explorerBaseUrl, metric.txHash);

    return {
      analysisId: metric.analysisId ?? index + 1,
      rootHash: metric.rootHash ?? metric.taskId,
      score: metric.score,
      recommendation: metric.recommendation,
      timestamp: metric.timestamp,
      explorerUrl: txUrl ?? data.integration.onChain.explorerUrl ?? data.network.explorerBaseUrl,
      txHash: metric.txHash,
      txUrl,
      source: metric.source,
      signed: metric.signatureVerified === true,
      taskId: metric.taskId,
      criticTotalChallenges: metric.criticTotalChallenges,
      criticUnresolvedChallenges: metric.criticUnresolvedChallenges,
      criticPenalty: metric.criticPenalty,
    };
  });
}

function getScoreStats(rows: FeedRow[]) {
  const scores = rows.map((row) => row.score).sort((a, b) => a - b);

  if (scores.length === 0) {
    return { average: 0, median: 0, stddev: 0 };
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const middle = Math.floor(scores.length / 2);
  const median =
    scores.length % 2 === 0
      ? ((scores[middle - 1] ?? 0) + (scores[middle] ?? 0)) / 2
      : scores[middle] ?? 0;
  const variance =
    scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / scores.length;

  return {
    average: Number(average.toFixed(1)),
    median: Number(median.toFixed(1)),
    stddev: Number(Math.sqrt(variance).toFixed(1)),
  };
}

function KpiCard({
  label,
  value,
  suffix,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: React.ReactNode;
  tone?: "default" | "success" | "warning" | "critical";
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--cm-accent)]/50"
      : tone === "warning"
        ? "border-[var(--cm-warning)]/50"
        : tone === "critical"
          ? "border-[var(--cm-critical)]/50"
          : "border-[var(--cm-border)]";

  return (
    <div className={cx("rounded-lg border bg-[var(--cm-surface)] p-4", toneClass)}>
      <span className="text-xs uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
        {label}
      </span>
      <div className="mt-4 flex items-baseline gap-1 font-mono">
        <span className="text-4xl font-semibold text-[var(--cm-text-primary)]">
          {value}
        </span>
        {suffix ? (
          <span className="text-lg text-[var(--cm-text-muted)]">{suffix}</span>
        ) : null}
      </div>
      <div className="mt-3 min-h-10 text-sm leading-5 text-[var(--cm-text-muted)]">
        {detail}
      </div>
    </div>
  );
}

function DistributionRow({
  recommendation,
  count,
  total,
}: {
  recommendation: Recommendation;
  count: number;
  total: number;
}) {
  const tone = recommendationTone(recommendation);
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const width = count > 0 ? Math.max(6, percentage) : 0;

  return (
    <div className="grid grid-cols-[minmax(132px,1fr)_40px_minmax(90px,1.2fr)_44px] items-center gap-3 text-sm max-sm:grid-cols-[1fr_auto] max-sm:gap-y-2">
      <span className="flex min-w-0 items-center gap-2 font-mono text-[var(--cm-text-primary)]">
        <span className={cx("h-2 w-2 rounded-full", tone.dot)} />
        <span className="truncate">{recommendation}</span>
      </span>
      <span className="font-mono text-[var(--cm-text-muted)] max-sm:text-right">
        {count}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-white/[0.05] max-sm:col-span-2">
        <span
          className={cx("block h-full rounded-full", tone.bar)}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="font-mono text-[var(--cm-text-muted)] max-sm:hidden">
        {percentage}%
      </span>
    </div>
  );
}

function PanelHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--cm-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--cm-text-primary)]">
          {title}
        </h2>
      </div>
      {meta ? (
        <span className="w-fit rounded-md border border-[var(--cm-border)] px-2 py-1 font-mono text-xs text-[var(--cm-text-muted)]">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "accent" | "critical" | "warning";
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--cm-border)] py-3 last:border-0">
      <span className="text-sm text-[var(--cm-text-muted)]">{label}</span>
      <span
        className={cx(
          "text-right font-mono text-sm text-[var(--cm-text-primary)]",
          tone === "accent" && "text-[var(--cm-accent)]",
          tone === "critical" && "text-[var(--cm-critical)]",
          tone === "warning" && "text-[var(--cm-warning)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FeedTable({
  rows,
  nowMs,
  explorerUrl,
}: {
  rows: FeedRow[];
  nowMs: number;
  explorerUrl?: string | null;
}) {
  const [shownLimit, setShownLimit] = useState(10);
  const [expandedId, setExpandedId] = useState<number | null>(rows[0]?.analysisId ?? null);
  const shownRows = rows.slice(0, shownLimit);
  const effectiveExpandedId =
    expandedId && rows.some((row) => row.analysisId === expandedId)
      ? expandedId
      : rows[0]?.analysisId ?? null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
              <th className="border-b border-[var(--cm-border)] px-3 py-3 font-medium">ID</th>
              <th className="border-b border-[var(--cm-border)] px-3 py-3 font-medium">Time</th>
              <th className="border-b border-[var(--cm-border)] px-3 py-3 font-medium">Score</th>
              <th className="border-b border-[var(--cm-border)] px-3 py-3 font-medium">Recommendation</th>
              <th className="border-b border-[var(--cm-border)] px-3 py-3 font-medium">Source</th>
              <th className="border-b border-[var(--cm-border)] px-3 py-3 font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row) => {
              const tone = recommendationTone(row.recommendation);
              const isOpen = effectiveExpandedId === row.analysisId;

              return (
                <Fragment key={row.analysisId}>
                  <tr
                    className={cx(
                      "cursor-pointer transition hover:bg-white/[0.03]",
                      isOpen && "bg-white/[0.03]",
                    )}
                    onClick={() => setExpandedId(isOpen ? null : row.analysisId)}
                  >
                    <td className="border-b border-[var(--cm-border)] px-3 py-4 font-mono text-sm text-[var(--cm-text-muted)]">
                      #{row.analysisId}
                    </td>
                    <td className="border-b border-[var(--cm-border)] px-3 py-4 font-mono text-sm text-[var(--cm-text-secondary)]">
                      {formatAge(row.timestamp, nowMs)}
                    </td>
                    <td className="border-b border-[var(--cm-border)] px-3 py-4">
                      <span className={cx("font-mono text-lg", tone.text)}>
                        {row.score}
                      </span>
                    </td>
                    <td className="border-b border-[var(--cm-border)] px-3 py-4">
                      <span className={cx("rounded-md border px-2 py-1 font-mono text-xs", tone.badge)}>
                        {row.recommendation}
                      </span>
                    </td>
                    <td className="border-b border-[var(--cm-border)] px-3 py-4">
                      <span className={cx("rounded-md border px-2 py-1 font-mono text-xs uppercase", sourceTone(row.source))}>
                        {row.source}
                      </span>
                    </td>
                    <td className="border-b border-[var(--cm-border)] px-3 py-4 font-mono text-sm">
                      <a
                        href={row.txUrl ?? row.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="text-[var(--cm-accent)] transition hover:text-teal-200"
                      >
                        {row.txHash ? shortHash(row.txHash, 8, 6) : "registry"}
                      </a>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={6} className="border-b border-[var(--cm-border)] bg-black/20 px-3 py-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                          <div className="grid gap-2 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-3 font-mono text-xs sm:grid-cols-[116px_minmax(0,1fr)]">
                            <span className="text-[var(--cm-text-muted)]">ROOT HASH</span>
                            <span className="break-all text-[var(--cm-text-secondary)]">{row.rootHash}</span>
                            {row.txHash ? (
                              <>
                                <span className="text-[var(--cm-text-muted)]">TX HASH</span>
                                <span className="break-all text-[var(--cm-text-secondary)]">{row.txHash}</span>
                              </>
                            ) : null}
                            {row.taskId ? (
                              <>
                                <span className="text-[var(--cm-text-muted)]">TASK ID</span>
                                <span className="break-all text-[var(--cm-text-secondary)]">{row.taskId}</span>
                              </>
                            ) : null}
                            <span className="text-[var(--cm-text-muted)]">SIGNED</span>
                            <span className={row.signed ? "text-[var(--cm-accent)]" : "text-[var(--cm-warning)]"}>
                              {row.signed ? "verified" : "not observed"}
                            </span>
                          </div>

                          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-3">
                            <ReceiptRow
                              label="Critic challenges"
                              value={row.criticTotalChallenges ?? "not tracked"}
                            />
                            <ReceiptRow
                              label="Unresolved"
                              value={row.criticUnresolvedChallenges ?? "not tracked"}
                              tone={row.criticUnresolvedChallenges ? "critical" : undefined}
                            />
                            <ReceiptRow
                              label="Score penalty"
                              value={
                                typeof row.criticPenalty === "number"
                                  ? `-${row.criticPenalty}`
                                  : "not tracked"
                              }
                              tone={row.criticPenalty ? "warning" : undefined}
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href={row.txUrl ?? row.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
                              >
                                View receipt
                              </a>
                              <Link
                                href="/judge"
                                className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
                              >
                                Judge view
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--cm-border)] px-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-xs text-[var(--cm-text-muted)]">
          showing {Math.min(shownLimit, rows.length)} of {rows.length} visible registry entries
        </span>
        <div className="flex flex-wrap gap-2">
          {shownLimit < rows.length ? (
            <button
              type="button"
              onClick={() => setShownLimit((current) => Math.min(current + 10, rows.length))}
              className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
            >
              Show more
            </button>
          ) : null}
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
            >
              Open registry
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <main className="min-h-screen bg-[var(--cm-background)] text-[var(--cm-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--cm-warning)]">
          Stats unavailable
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Judge API did not respond.</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--cm-text-muted)]">
          The dashboard is intentionally backed by live `/api/judge` data. Try refreshing,
          or open the raw endpoint to inspect the current deployment state.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/stats"
            className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-sm text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
          >
            Refresh stats
          </Link>
          <a
            href="/api/judge"
            className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-sm text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
          >
            Open API JSON
          </a>
        </div>
      </div>
    </main>
  );
}

export function StatsDashboard({ data, version, buildHash }: StatsDashboardProps) {
  const [liveData, setLiveData] = useState<StatsJudgeData | null>(data);
  const [nowMs, setNowMs] = useState(() => data ? Date.parse(data.generatedAt) : Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(`/api/judge?stats=${Date.now()}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return;
      }

      const nextData = (await response.json()) as StatsJudgeData;
      setLiveData(nextData);
      setNowMs(Date.now());
    } catch (error) {
      console.warn("[Stats] Failed to refresh judge data", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNowMs(Date.now()), 1_000);
    const refresh = window.setInterval(() => {
      void refreshData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [refreshData]);

  const rows = useMemo(() => buildFeedRows(liveData), [liveData]);
  const scoreStats = useMemo(() => getScoreStats(rows), [rows]);

  if (!liveData) {
    return <EmptyState />;
  }

  const generatedAtMs = Date.parse(liveData.generatedAt);
  const secondsToRefresh = Math.max(
    0,
    Math.ceil((REFRESH_INTERVAL_MS - (nowMs - generatedAtMs)) / 1_000),
  );
  const distributionTotal = Object.values(liveData.scoreDistribution).reduce(
    (sum, count) => sum + count,
    0,
  );
  const signed = liveData.integration.onChain.operatorAuthentication.signatureVerified;
  const critic = liveData.criticEffectiveness;
  const resolvedPct =
    critic.totalChallenges > 0
      ? Math.round((critic.resolvedChallenges / critic.totalChallenges) * 100)
      : 0;
  const unresolvedPct =
    critic.totalChallenges > 0
      ? Math.round((critic.unresolvedChallenges / critic.totalChallenges) * 100)
      : 0;
  const mcpTracked = liveData.mcpUsage.trackedAnalyses;
  const mcpPct =
    mcpTracked > 0
      ? Math.round((liveData.mcpUsage.mcpInitiatedAnalyses / mcpTracked) * 100)
      : 0;
  const latest = rows[0] ?? null;

  function refreshNow() {
    void refreshData();
  }

  return (
    <main className="min-h-screen bg-[var(--cm-background)] text-[var(--cm-text-primary)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="sticky top-0 z-20 -mx-5 border-b border-[var(--cm-border)] bg-[var(--cm-background)]/88 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
                LIVE METRICS · {liveData.network.name === "mainnet" ? "0G MAINNET" : "0G TESTNET"}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
                Stats
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cm-text-muted)]">
                Public telemetry from the ClawMind pipeline: on-chain analyses,
                signed registry status, Critic impact, semantic memory, and MCP usage.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/"
                className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-sm text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
              >
                Main page
              </Link>
              <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 font-mono text-xs text-[var(--cm-text-muted)]">
                <span className="text-[var(--cm-text-secondary)]">last update</span>{" "}
                {formatAge(Math.floor(generatedAtMs / 1_000), nowMs)}
                <span className="mx-2 text-[var(--cm-border-emphasis)]">/</span>
                <span title={`Next refresh in ${secondsToRefresh}s`}>
                  auto {secondsToRefresh}s
                </span>
              </div>
              <button
                type="button"
                onClick={refreshNow}
                className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 font-mono text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
              >
                <span className={cx("inline-block", refreshing && "animate-spin")}>↻</span>
                <span className="ml-2">refresh</span>
              </button>
              <Link
                href="/analysis"
                className="rounded-lg border border-[var(--cm-accent)] bg-[var(--cm-accent)] px-4 py-2 text-sm font-medium text-black transition hover:bg-teal-300"
              >
                Run analysis
              </Link>
              <a
                href="/api/judge"
                className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-sm text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
              >
                API JSON
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total analyses"
            value={liveData.analysisCount.toLocaleString()}
            detail={
              <>
                Registry count on chain ID{" "}
                <span className="font-mono text-[var(--cm-text-secondary)]">
                  {liveData.network.chainId}
                </span>
                .
              </>
            }
          />
          <KpiCard
            label="Signed registry"
            value={signed ? "100" : "0"}
            suffix="%"
            tone={signed ? "success" : "warning"}
            detail={
              signed
                ? "Current registry requires EIP-712 operator signatures."
                : "Signature verification is not confirmed by the latest registry read."
            }
          />
          <KpiCard
            label="Semantic memory"
            value={liveData.memory.totalRecords.toLocaleString()}
            detail={
              <>
                <span className="font-mono text-[var(--cm-text-secondary)]">
                  {liveData.memory.seedCount}
                </span>{" "}
                seed +{" "}
                <span className="font-mono text-[var(--cm-text-secondary)]">
                  {liveData.memory.runtimeGeneratedCount}
                </span>{" "}
                runtime records in the deduped index.
              </>
            }
          />
          <KpiCard
            label="MCP initiated"
            value={liveData.mcpUsage.mcpInitiatedAnalyses.toLocaleString()}
            detail={
              mcpTracked > 0
                ? `${mcpPct}% of ${mcpTracked} tracked analyses came through MCP.`
                : "No source-attributed analyses recorded yet."
            }
          />
        </section>

        {latest ? (
          <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface-elevated)] p-4">
            <div className="flex flex-col gap-4 font-mono text-xs text-[var(--cm-text-secondary)] lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-2 text-[var(--cm-accent)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--cm-accent)] animate-pulse" />
                  LIVE
                </span>
                <span>Latest #{latest.analysisId}</span>
                <span className="text-[var(--cm-border-emphasis)]">·</span>
                <span>{formatAge(latest.timestamp, nowMs)}</span>
                <span className="text-[var(--cm-border-emphasis)]">·</span>
                <span>{latest.recommendation} score {latest.score}</span>
                <span className="text-[var(--cm-border-emphasis)]">·</span>
                <span>
                  {latest.signed ? "signed operator verified" : "signature not observed"}
                </span>
              </div>
              <a
                href={latest.txUrl ?? latest.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="w-fit rounded-lg border border-[var(--cm-border)] px-3 py-2 text-[var(--cm-text-primary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
              >
                View receipt
              </a>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
            <div className="p-5">
              <PanelHeader
                eyebrow="Score distribution"
                title="Recent on-chain decisions"
                meta={`${distributionTotal} visible`}
              />
              <div className="mt-5 space-y-5">
                <DistributionRow
                  recommendation="GO"
                  count={liveData.scoreDistribution.GO}
                  total={distributionTotal}
                />
                <DistributionRow
                  recommendation="INVESTIGATE_MORE"
                  count={liveData.scoreDistribution.INVESTIGATE_MORE}
                  total={distributionTotal}
                />
                <DistributionRow
                  recommendation="NO_GO"
                  count={liveData.scoreDistribution.NO_GO}
                  total={distributionTotal}
                />
              </div>
            </div>
            <div className="grid border-t border-[var(--cm-border)] sm:grid-cols-3">
              <div className="border-b border-[var(--cm-border)] p-4 sm:border-b-0 sm:border-r">
                <p className="font-mono text-xs uppercase text-[var(--cm-text-muted)]">AVG score</p>
                <p className="mt-2 font-mono text-2xl">{scoreStats.average}</p>
              </div>
              <div className="border-b border-[var(--cm-border)] p-4 sm:border-b-0 sm:border-r">
                <p className="font-mono text-xs uppercase text-[var(--cm-text-muted)]">Median</p>
                <p className="mt-2 font-mono text-2xl">{scoreStats.median}</p>
              </div>
              <div className="p-4">
                <p className="font-mono text-xs uppercase text-[var(--cm-text-muted)]">Stddev</p>
                <p className="mt-2 font-mono text-2xl">{scoreStats.stddev}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
            <PanelHeader
              eyebrow="Critic effectiveness"
              title="Unresolved challenges change scores"
              meta={`${critic.sampleSize} tracked`}
            />
            <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-black/20 px-4">
              <ReceiptRow label="Total challenges raised" value={critic.totalChallenges} />
              <ReceiptRow
                label="Resolved by final agent"
                value={`${critic.resolvedChallenges} · ${resolvedPct}%`}
                tone="accent"
              />
              <ReceiptRow
                label="Unresolved"
                value={`${critic.unresolvedChallenges} · ${unresolvedPct}%`}
                tone={critic.unresolvedChallenges > 0 ? "critical" : undefined}
              />
              <ReceiptRow
                label="Avg challenges per run"
                value={critic.averageChallenges.toFixed(1)}
              />
              <ReceiptRow
                label="Avg score adjustment"
                value={`-${critic.averagePenalty.toFixed(1)}`}
                tone={critic.averagePenalty > 0 ? "warning" : undefined}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--cm-text-muted)]">
              The panel uses local run metrics when available. On-chain registry data remains
              the source of truth for scores, recommendations, and receipt integrity.
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <div className="overflow-hidden rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
            <div className="p-5">
              <PanelHeader
                eyebrow="Recent analyses"
                title="Registry feed"
                meta={`refreshed ${formatGeneratedAt(liveData.generatedAt)}`}
              />
            </div>
            {rows.length > 0 ? (
              <FeedTable
                rows={rows}
                nowMs={nowMs}
                explorerUrl={liveData.integration.onChain.explorerUrl}
              />
            ) : (
              <div className="border-t border-[var(--cm-border)] p-5 text-sm text-[var(--cm-text-muted)]">
                No recent registry entries are visible yet.
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
              <PanelHeader eyebrow="MCP usage" title="Infrastructure surface" />
              <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-black/20 px-4">
                <ReceiptRow
                  label="Endpoint"
                  value={
                    <a
                      href={MCP_ENDPOINT}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--cm-accent)] hover:text-teal-200"
                    >
                      /sse
                    </a>
                  }
                />
                <ReceiptRow
                  label="Requests"
                  value={`${liveData.mcpUsage.mcpInitiatedAnalyses} of ${mcpTracked}`}
                  tone={liveData.mcpUsage.mcpInitiatedAnalyses > 0 ? "accent" : undefined}
                />
                <ReceiptRow label="Web initiated" value={liveData.mcpUsage.webInitiatedAnalyses} />
                <ReceiptRow label="Rate limit" value="60s / client" />
              </div>
              <div className="mt-4 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-3 font-mono text-xs leading-5 text-[var(--cm-text-muted)]">
                X-MCP-Client-Id required · analyze_web3_project · get_recent_analyses
              </div>
            </div>

            <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
              <PanelHeader eyebrow="Memory index" title="Semantic retrieval" />
              <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-black/20 px-4">
                <ReceiptRow
                  label="Status"
                  value={liveData.memory.semanticRetrievalActive ? "active" : "pending"}
                  tone={liveData.memory.semanticRetrievalActive ? "accent" : "warning"}
                />
                <ReceiptRow label="0G-backed records" value={liveData.memory.zeroGBackedCount} />
                <ReceiptRow label="Runtime records" value={liveData.memory.runtimeGeneratedCount} />
                <ReceiptRow label="Seed records" value={liveData.memory.seedCount} />
              </div>
              {liveData.memory.semanticRetrievalExample ? (
                <p className="mt-4 text-sm leading-6 text-[var(--cm-text-muted)]">
                  {liveData.memory.semanticRetrievalExample}
                </p>
              ) : null}
              {liveData.memory.latestMemoryIndexUri ? (
                <div className="mt-4 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-3">
                  <p className="font-mono text-xs uppercase text-[var(--cm-text-muted)]">
                    Latest index URI
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--cm-text-secondary)]">
                    {liveData.memory.latestMemoryIndexUri}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
              <PanelHeader eyebrow="Integrity" title="Signed registry" />
              <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-black/20 px-4">
                <ReceiptRow
                  label="Contract"
                  value={
                    liveData.integration.onChain.contractAddress ? (
                      <a
                        href={liveData.integration.onChain.explorerUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--cm-accent)] hover:text-teal-200"
                      >
                        {shortHash(liveData.integration.onChain.contractAddress, 8, 4)}
                      </a>
                    ) : (
                      "not configured"
                    )
                  }
                />
                <ReceiptRow
                  label="Operator"
                  value={shortHash(liveData.integration.onChain.operatorAuthentication.operatorAddress, 8, 4)}
                />
                <ReceiptRow
                  label="Authorized"
                  value={
                    liveData.integration.onChain.operatorAuthentication.operatorAuthorized === true
                      ? "true"
                      : liveData.integration.onChain.operatorAuthentication.operatorAuthorized === false
                        ? "false"
                        : "unknown"
                  }
                  tone={
                    liveData.integration.onChain.operatorAuthentication.operatorAuthorized === true
                      ? "accent"
                      : "warning"
                  }
                />
                <ReceiptRow
                  label="Mode"
                  value={liveData.integration.onChain.operatorAuthentication.mode}
                />
              </div>
            </div>
          </aside>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[var(--cm-border)] py-6 text-xs text-[var(--cm-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono">
            ClawMind stats · v{version} · build {buildHash}
          </span>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="transition hover:text-[var(--cm-accent)]">Landing</Link>
            <Link href="/analysis" className="transition hover:text-[var(--cm-accent)]">Run analysis</Link>
            <Link href="/judge" className="transition hover:text-[var(--cm-accent)]">Judge mode</Link>
            <a href="/api/openclaw/manifest" className="transition hover:text-[var(--cm-accent)]">OpenClaw manifest</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
