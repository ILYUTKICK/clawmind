import Redis from "ioredis";
import {
  AgentName,
  AgentProvider,
  AgentStatus,
  AgentStep,
  AgentTraceSnapshot,
  AnalysisResult,
  AnalysisSource,
  AnalysisTraceSummary,
  Recommendation,
} from "@/lib/types";

const REDIS_KEY = "clawmind:analysis:metrics:v1";
const MAX_METRICS = 100;

export type AnalysisMetric = {
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
  trace?: AnalysisTraceSummary;
};

type StepLatencySummary = {
  name: AgentName;
  label: string;
  samples: number;
  averageDurationMs: number;
  maxDurationMs: number;
  provider?: AgentProvider;
};

export type AnalysisMetricsSummary = {
  trackedAnalyses: number;
  scoreDistribution: Record<Recommendation, number>;
  sources: {
    web: number;
    mcp: number;
  };
  critic: {
    sampleSize: number;
    totalChallenges: number;
    resolvedChallenges: number;
    unresolvedChallenges: number;
    averageChallenges: number;
    averagePenalty: number;
  };
  observability: {
    sampleSize: number;
    averageDurationMs: number;
    averageCompletedSteps: number;
    failedStepTotal: number;
    providerBreakdown: Record<string, number>;
    slowestStep: StepLatencySummary | null;
    latestTrace: AnalysisTraceSummary | null;
    costStatus: "not_reported";
  };
  recent: AnalysisMetric[];
};

let redisClient: Redis | null = null;
let redisChecked = false;
const memoryMetrics: AnalysisMetric[] = [];

function durationBetween(startedAt?: string, finishedAt?: string): number | undefined {
  if (!startedAt || !finishedAt) {
    return undefined;
  }

  const startedMs = Date.parse(startedAt);
  const finishedMs = Date.parse(finishedAt);

  if (!Number.isFinite(startedMs) || !Number.isFinite(finishedMs)) {
    return undefined;
  }

  return Math.max(0, finishedMs - startedMs);
}

function normalizeStatus(status: AgentStep["status"]): AgentStatus {
  if (status === "pending" || status === "running" || status === "completed" || status === "failed") {
    return status;
  }

  return "failed";
}

function getCostStatus(provider?: AgentProvider): AgentTraceSnapshot["costStatus"] {
  return provider === "LOCAL_EMBEDDINGS" || provider === "LOCAL_FALLBACK" || provider === "NOT_CONFIGURED"
    ? "not_applicable"
    : "not_reported";
}

function traceSnapshotFromStep(step: AgentStep): AgentTraceSnapshot {
  const durationMs = typeof step.durationMs === "number"
    ? Math.max(0, Math.round(step.durationMs))
    : durationBetween(step.startedAt, step.finishedAt);
  const provider = step.provider;

  return {
    name: step.name,
    label: step.label,
    status: normalizeStatus(step.status),
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    durationMs,
    model: step.modelId ?? step.model,
    modelFamily: step.modelFamily,
    provider,
    inputChars: step.inputChars ?? step.input?.length,
    outputChars: step.outputChars ?? step.output?.length,
    error: step.error,
    costStatus: step.costStatus ?? getCostStatus(provider),
  };
}

export function buildAnalysisTraceSummary(steps: AgentStep[]): AnalysisTraceSummary {
  const snapshots = steps.map(traceSnapshotFromStep);
  const completedSteps = snapshots.filter((step) => step.status === "completed").length;
  const failedSteps = snapshots.filter((step) => step.status === "failed").length;
  const providerBreakdown: Record<string, number> = {};

  for (const step of snapshots) {
    const provider = step.provider ?? "unknown";
    providerBreakdown[provider] = (providerBreakdown[provider] ?? 0) + 1;
  }

  const timedSteps = snapshots.filter((step) => typeof step.durationMs === "number");
  const slowestStep = timedSteps.reduce<AgentTraceSnapshot | undefined>((slowest, step) => {
    if (!slowest || (step.durationMs ?? 0) > (slowest.durationMs ?? 0)) {
      return step;
    }

    return slowest;
  }, undefined);

  const startedValues = snapshots
    .map((step) => step.startedAt ? Date.parse(step.startedAt) : NaN)
    .filter(Number.isFinite);
  const finishedValues = snapshots
    .map((step) => step.finishedAt ? Date.parse(step.finishedAt) : NaN)
    .filter(Number.isFinite);
  const hasCompleteWallClock =
    snapshots.length > 0 &&
    snapshots.every((step) => {
      if (typeof step.durationMs !== "number") {
        return true;
      }

      return Boolean(step.startedAt && step.finishedAt);
    });
  const wallClockDuration =
    hasCompleteWallClock && startedValues.length > 0 && finishedValues.length > 0
      ? Math.max(0, Math.max(...finishedValues) - Math.min(...startedValues))
      : 0;
  const summedDuration = timedSteps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);

  return {
    totalDurationMs: Math.round(wallClockDuration || summedDuration),
    completedSteps,
    failedSteps,
    providerBreakdown,
    slowestStep,
    steps: snapshots,
  };
}

function getRedisUrl(): string {
  return process.env.KV_REDIS_URL || process.env.REDIS_URL || "";
}

async function getRedis(): Promise<Redis | null> {
  if (redisChecked) {
    return redisClient;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    redisChecked = true;
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3_000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) {
          return null;
        }

        return Math.min(times * 200, 1_000);
      },
    });

    await client.ping();
    redisClient = client;
    redisChecked = true;
    return redisClient;
  } catch {
    redisClient = null;
    redisChecked = true;
    return null;
  }
}

function metricFromResult(taskId: string, source: AnalysisSource, result: AnalysisResult): AnalysisMetric {
  const critic = result.report.criticAdjustment;

  return {
    taskId,
    source,
    score: result.report.score,
    recommendation: result.report.recommendation,
    timestamp: Math.floor(Date.now() / 1_000),
    analysisId: result.onChainReceipt?.analysisId,
    rootHash: result.receipt.reportHash,
    txHash: result.onChainReceipt?.txHash,
    signatureVerified: result.onChainReceipt?.signatureVerified === true,
    criticTotalChallenges: critic?.totalChallenges ?? 0,
    criticResolvedChallenges: critic?.resolvedChallenges ?? 0,
    criticUnresolvedChallenges: critic?.unresolvedChallenges ?? 0,
    criticPenalty: critic?.penalty ?? 0,
    trace: buildAnalysisTraceSummary(result.steps),
  };
}

export async function recordAnalysisMetric(
  taskId: string,
  source: AnalysisSource,
  result: AnalysisResult,
): Promise<void> {
  const metric = metricFromResult(taskId, source, result);
  const redis = await getRedis();

  if (redis) {
    try {
      await redis.lpush(REDIS_KEY, JSON.stringify(metric));
      await redis.ltrim(REDIS_KEY, 0, MAX_METRICS - 1);
      return;
    } catch {
      // Fall through to in-memory storage for local/dev resilience.
    }
  }

  memoryMetrics.unshift(metric);
  memoryMetrics.splice(MAX_METRICS);
}

export async function getAnalysisMetrics(limit = MAX_METRICS): Promise<AnalysisMetric[]> {
  const boundedLimit = Math.max(1, Math.min(limit, MAX_METRICS));
  const redis = await getRedis();

  if (redis) {
    try {
      const rawMetrics = await redis.lrange(REDIS_KEY, 0, boundedLimit - 1);
      return rawMetrics
        .map((raw): AnalysisMetric | null => {
          try {
            return JSON.parse(raw) as AnalysisMetric;
          } catch {
            return null;
          }
        })
        .filter((metric): metric is AnalysisMetric => metric !== null);
    } catch {
      return memoryMetrics.slice(0, boundedLimit);
    }
  }

  return memoryMetrics.slice(0, boundedLimit);
}

export async function getAnalysisMetricsSummary(): Promise<AnalysisMetricsSummary> {
  const recent = await getAnalysisMetrics();
  const scoreDistribution: Record<Recommendation, number> = {
    GO: 0,
    INVESTIGATE_MORE: 0,
    NO_GO: 0,
  };
  const sources = {
    web: 0,
    mcp: 0,
  };
  let totalChallenges = 0;
  let resolvedChallenges = 0;
  let unresolvedChallenges = 0;
  let totalPenalty = 0;
  let traceSampleSize = 0;
  let totalDurationMs = 0;
  let totalCompletedSteps = 0;
  let failedStepTotal = 0;
  const providerBreakdown: Record<string, number> = {};
  const stepLatency = new Map<AgentName, {
    label: string;
    samples: number;
    totalDurationMs: number;
    maxDurationMs: number;
    provider?: AgentProvider;
  }>();

  for (const metric of recent) {
    scoreDistribution[metric.recommendation] += 1;
    sources[metric.source] += 1;
    totalChallenges += metric.criticTotalChallenges;
    resolvedChallenges += metric.criticResolvedChallenges;
    unresolvedChallenges += metric.criticUnresolvedChallenges;
    totalPenalty += metric.criticPenalty;

    if (metric.trace) {
      traceSampleSize += 1;
      totalDurationMs += metric.trace.totalDurationMs;
      totalCompletedSteps += metric.trace.completedSteps;
      failedStepTotal += metric.trace.failedSteps;

      for (const [provider, count] of Object.entries(metric.trace.providerBreakdown)) {
        providerBreakdown[provider] = (providerBreakdown[provider] ?? 0) + count;
      }

      for (const step of metric.trace.steps) {
        if (typeof step.durationMs !== "number") {
          continue;
        }

        const current = stepLatency.get(step.name) ?? {
          label: step.label,
          samples: 0,
          totalDurationMs: 0,
          maxDurationMs: 0,
          provider: step.provider,
        };

        current.samples += 1;
        current.totalDurationMs += step.durationMs;
        current.maxDurationMs = Math.max(current.maxDurationMs, step.durationMs);
        current.provider = current.provider ?? step.provider;
        stepLatency.set(step.name, current);
      }
    }
  }

  const sampleSize = recent.length;
  const slowestStep = Array.from(stepLatency.entries())
    .map(([name, value]): StepLatencySummary => ({
      name,
      label: value.label,
      samples: value.samples,
      averageDurationMs: value.samples > 0 ? Math.round(value.totalDurationMs / value.samples) : 0,
      maxDurationMs: value.maxDurationMs,
      provider: value.provider,
    }))
    .sort((a, b) => b.averageDurationMs - a.averageDurationMs)[0] ?? null;

  return {
    trackedAnalyses: sampleSize,
    scoreDistribution,
    sources,
    critic: {
      sampleSize,
      totalChallenges,
      resolvedChallenges,
      unresolvedChallenges,
      averageChallenges: sampleSize > 0 ? Number((totalChallenges / sampleSize).toFixed(1)) : 0,
      averagePenalty: sampleSize > 0 ? Number((totalPenalty / sampleSize).toFixed(1)) : 0,
    },
    observability: {
      sampleSize: traceSampleSize,
      averageDurationMs: traceSampleSize > 0 ? Math.round(totalDurationMs / traceSampleSize) : 0,
      averageCompletedSteps: traceSampleSize > 0
        ? Number((totalCompletedSteps / traceSampleSize).toFixed(1))
        : 0,
      failedStepTotal,
      providerBreakdown,
      slowestStep,
      latestTrace: recent.find((metric) => metric.trace)?.trace ?? null,
      costStatus: "not_reported",
    },
    recent,
  };
}
