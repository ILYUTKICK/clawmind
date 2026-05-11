import Link from "next/link";

export const revalidate = 30;
export const dynamic = "force-dynamic";

type Recommendation = "GO" | "NO_GO" | "INVESTIGATE_MORE";

type JudgeRecentAnalysis = {
  analysisId: number;
  rootHash: string;
  score: number;
  recommendation: Recommendation;
  timestamp: number;
  explorerUrl: string;
};

type JudgeData = {
  analysisCount: number;
  recentAnalyses: JudgeRecentAnalysis[];
  scoreDistribution?: Record<Recommendation, number>;
  criticEffectiveness?: {
    sampleSize: number;
    totalChallenges: number;
    resolvedChallenges: number;
    unresolvedChallenges: number;
    averageChallenges: number;
    averagePenalty: number;
  };
  mcpUsage?: {
    trackedAnalyses: number;
    mcpInitiatedAnalyses: number;
    webInitiatedAnalyses: number;
  };
  memory: {
    totalRecords: number;
    runtimeGeneratedCount: number;
    seedCount: number;
    semanticRetrievalActive: boolean;
    latestMemoryIndexUri: string | null;
  };
  integration: {
    onChain: {
      contractAddress: string | null;
      explorerUrl: string | null;
      operatorAuthentication: {
        signatureVerified: boolean;
      };
    };
  };
  generatedAt: string;
};

function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.CLAWMIND_APP_BASE_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://clawmind-puce.vercel.app";
}

async function getJudgeData(): Promise<JudgeData> {
  const response = await fetch(`${getBaseUrl()}/api/judge`, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Judge API failed with HTTP ${response.status}.`);
  }

  return response.json() as Promise<JudgeData>;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp * 1_000));
}

function shortHash(value: string): string {
  if (!value || value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function recommendationClass(recommendation: Recommendation): string {
  if (recommendation === "GO") {
    return "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200";
  }

  if (recommendation === "NO_GO") {
    return "border-[var(--cm-critical)] bg-[var(--cm-critical)]/10 text-red-200";
  }

  return "border-[var(--cm-warning)] bg-[var(--cm-warning)]/10 text-amber-200";
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-4">
      <p className="text-xs uppercase text-[var(--cm-text-muted)]">{label}</p>
      <p className="mt-3 font-mono text-3xl font-semibold text-[var(--cm-text-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--cm-text-muted)]">{detail}</p>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  total,
  className,
}: {
  label: Recommendation;
  count: number;
  total: number;
  className: string;
}) {
  const width = total > 0 ? Math.max(8, Math.round((count / total) * 100)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-mono text-[var(--cm-text-primary)]">{label}</span>
        <span className="font-mono text-[var(--cm-text-muted)]">{count}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm bg-white/[0.04]">
        <div className={`h-full ${className}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function StatsPage() {
  const data = await getJudgeData();
  const distribution = data.scoreDistribution ?? {
    GO: 0,
    INVESTIGATE_MORE: 0,
    NO_GO: 0,
  };
  const visibleDistributionTotal = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const signedPercent = data.integration.onChain.operatorAuthentication.signatureVerified ? "100%" : "Pending";
  const critic = data.criticEffectiveness;
  const mcpUsage = data.mcpUsage;

  return (
    <main className="min-h-screen bg-[var(--cm-background)] text-[var(--cm-text-primary)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[var(--cm-border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase text-[var(--cm-text-muted)]">Public Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[var(--cm-text-primary)]">
              ClawMind Stats
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cm-text-muted)]">
              Live 0G mainnet analyses, signed registry status, memory growth, and MCP usage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/judge"
              className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-sm text-zinc-200 transition hover:border-[var(--cm-accent)] hover:text-teal-200"
            >
              Judge mode
            </Link>
            <a
              href="/api/judge"
              className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-sm text-zinc-200 transition hover:border-[var(--cm-accent)] hover:text-teal-200"
            >
              API JSON
            </a>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Total analyses on 0G mainnet"
            value={data.analysisCount.toLocaleString()}
            detail="Read from AnalysisRegistry.analysisCount()."
          />
          <Kpi
            label="Signed by EIP-712 operator"
            value={signedPercent}
            detail="Latest registry entry verifies authorized operator signature."
          />
          <Kpi
            label="Runtime memory records"
            value={data.memory.runtimeGeneratedCount.toLocaleString()}
            detail={`${data.memory.seedCount} seed + ${data.memory.runtimeGeneratedCount} runtime records.`}
          />
          <Kpi
            label="MCP initiated analyses"
            value={(mcpUsage?.mcpInitiatedAnalyses ?? 0).toLocaleString()}
            detail={`${mcpUsage?.trackedAnalyses ?? 0} tracked analyses with source metadata.`}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-[var(--cm-text-muted)]">Score Distribution</p>
                <h2 className="mt-2 text-xl font-semibold">Recent on-chain decisions</h2>
              </div>
              <span className="rounded-md border border-[var(--cm-border)] px-2 py-1 font-mono text-xs text-[var(--cm-text-muted)]">
                last {visibleDistributionTotal}
              </span>
            </div>
            <div className="space-y-5">
              <DistributionBar label="GO" count={distribution.GO} total={visibleDistributionTotal} className="bg-[var(--cm-accent)]" />
              <DistributionBar label="INVESTIGATE_MORE" count={distribution.INVESTIGATE_MORE} total={visibleDistributionTotal} className="bg-[var(--cm-warning)]" />
              <DistributionBar label="NO_GO" count={distribution.NO_GO} total={visibleDistributionTotal} className="bg-[var(--cm-critical)]" />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
            <p className="text-xs uppercase text-[var(--cm-text-muted)]">Critic Effectiveness</p>
            <h2 className="mt-2 text-xl font-semibold">Unresolved challenges change scores</h2>
            <div className="mt-5 grid gap-4 border-y border-[var(--cm-border)] py-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-[var(--cm-text-muted)]">Tracked sample</p>
                <p className="mt-2 font-mono text-3xl font-semibold">{(critic?.sampleSize ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-sm text-[var(--cm-text-muted)]">Completed analyses with local metrics.</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--cm-text-muted)]">Average penalty</p>
                <p className="mt-2 font-mono text-3xl font-semibold">-{critic?.averagePenalty ?? 0}</p>
                <p className="mt-1 text-sm text-[var(--cm-text-muted)]">{critic?.averageChallenges ?? 0} critic challenges per tracked run.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[var(--cm-text-muted)]">Raised</p>
                <p className="mt-2 font-mono text-2xl">{critic?.totalChallenges ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--cm-text-muted)]">Resolved</p>
                <p className="mt-2 font-mono text-2xl text-[var(--cm-accent)]">{critic?.resolvedChallenges ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--cm-text-muted)]">Unresolved</p>
                <p className="mt-2 font-mono text-2xl text-[var(--cm-critical)]">{critic?.unresolvedChallenges ?? 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-[var(--cm-text-muted)]">Live Feed</p>
                <h2 className="mt-2 text-xl font-semibold">Latest registry entries</h2>
              </div>
              <span className="font-mono text-xs text-[var(--cm-text-muted)]">
                refreshed {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="divide-y divide-[var(--cm-border)]">
              {data.recentAnalyses.map((analysis) => (
                <details key={analysis.analysisId} className="group py-3">
                  <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-[var(--cm-text-muted)]">#{analysis.analysisId}</span>
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${recommendationClass(analysis.recommendation)}`}>
                        {analysis.recommendation}
                      </span>
                      <span className="font-mono text-sm">{analysis.score}</span>
                    </div>
                    <span className="font-mono text-xs text-[var(--cm-text-muted)]">{formatTime(analysis.timestamp)}</span>
                  </summary>
                  <div className="mt-3 grid gap-2 rounded-lg border border-[var(--cm-border)] bg-black/20 p-3 text-xs sm:grid-cols-[120px_minmax(0,1fr)]">
                    <span className="text-[var(--cm-text-muted)]">ROOT HASH</span>
                    <span className="break-all font-mono">{analysis.rootHash}</span>
                    <span className="text-[var(--cm-text-muted)]">EXPLORER</span>
                    <a href={analysis.explorerUrl} className="font-mono text-[var(--cm-accent)]" target="_blank" rel="noreferrer">
                      {shortHash(analysis.explorerUrl)}
                    </a>
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
            <p className="text-xs uppercase text-[var(--cm-text-muted)]">MCP Usage</p>
            <h2 className="mt-2 text-xl font-semibold">Infrastructure surface</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cm-border)] p-3">
                <span className="text-[var(--cm-text-muted)]">MCP endpoint</span>
                <a href="https://clawmind-mcp.vercel.app/mcp" className="font-mono text-xs text-[var(--cm-accent)]" target="_blank" rel="noreferrer">
                  /mcp
                </a>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cm-border)] p-3">
                <span className="text-[var(--cm-text-muted)]">Web initiated</span>
                <span className="font-mono">{mcpUsage?.webInitiatedAnalyses ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cm-border)] p-3">
                <span className="text-[var(--cm-text-muted)]">Memory retrieval</span>
                <span className={data.memory.semanticRetrievalActive ? "text-[var(--cm-accent)]" : "text-[var(--cm-warning)]"}>
                  {data.memory.semanticRetrievalActive ? "active" : "pending"}
                </span>
              </div>
              {data.memory.latestMemoryIndexUri ? (
                <div className="rounded-lg border border-[var(--cm-border)] p-3">
                  <p className="text-[var(--cm-text-muted)]">Latest memory index</p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">{data.memory.latestMemoryIndexUri}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
