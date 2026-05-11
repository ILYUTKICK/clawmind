import Redis from "ioredis";
import { AnalysisResult, AnalysisSource, Recommendation } from "@/lib/types";

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
  recent: AnalysisMetric[];
};

let redisClient: Redis | null = null;
let redisChecked = false;
const memoryMetrics: AnalysisMetric[] = [];

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

  for (const metric of recent) {
    scoreDistribution[metric.recommendation] += 1;
    sources[metric.source] += 1;
    totalChallenges += metric.criticTotalChallenges;
    resolvedChallenges += metric.criticResolvedChallenges;
    unresolvedChallenges += metric.criticUnresolvedChallenges;
    totalPenalty += metric.criticPenalty;
  }

  const sampleSize = recent.length;

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
    recent,
  };
}
