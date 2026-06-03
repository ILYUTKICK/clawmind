import crypto from "crypto";
import Redis from "ioredis";
import { NextRequest } from "next/server";

const KEY_PREFIX = "clawmind:analyze:rate:";
const DEFAULT_WINDOW_SECONDS = 60;
const MAX_WINDOW_SECONDS = 3600;

type RateLimitResult =
  | {
      allowed: true;
      retryAfterSeconds: 0;
      clientKey: string;
      windowSeconds: number;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      clientKey: string;
      windowSeconds: number;
    };

let redisClient: Redis | null = null;
let redisChecked = false;
const localLimits = new Map<string, number>();

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
    redisChecked = true;
    redisClient = null;
    return null;
  }
}

function getWindowSeconds(): number {
  const rawWindow = process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS;

  if (!rawWindow) {
    return DEFAULT_WINDOW_SECONDS;
  }

  const parsedWindow = Number.parseInt(rawWindow, 10);

  if (!Number.isFinite(parsedWindow) || parsedWindow < 1) {
    console.warn(
      `[Analyze RateLimit] Invalid CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS=${rawWindow}; using ${DEFAULT_WINDOW_SECONDS}.`,
    );
    return DEFAULT_WINDOW_SECONDS;
  }

  return Math.min(parsedWindow, MAX_WINDOW_SECONDS);
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function getClientKey(request: NextRequest): string {
  const ip = getClientIp(request);

  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export async function checkAnalyzeRateLimit(
  request: NextRequest,
): Promise<RateLimitResult> {
  const windowSeconds = getWindowSeconds();
  const clientKey = getClientKey(request);
  const redis = await getRedis();

  if (redis) {
    const key = `${KEY_PREFIX}${clientKey}`;
    const result = await redis.set(key, "1", "EX", windowSeconds, "NX");

    if (result === "OK") {
      return {
        allowed: true,
        retryAfterSeconds: 0,
        clientKey,
        windowSeconds,
      };
    }

    const ttl = await redis.ttl(key);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, ttl),
      clientKey,
      windowSeconds,
    };
  }

  const now = Date.now();
  const expiresAt = localLimits.get(clientKey) ?? 0;

  if (expiresAt > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((expiresAt - now) / 1_000),
      clientKey,
      windowSeconds,
    };
  }

  localLimits.set(clientKey, now + windowSeconds * 1_000);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    clientKey,
    windowSeconds,
  };
}

export function resetAnalyzeRateLimitStateForTests(): void {
  redisClient = null;
  redisChecked = false;
  localLimits.clear();
}
