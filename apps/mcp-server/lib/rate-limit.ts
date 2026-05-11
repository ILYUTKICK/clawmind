import Redis from "ioredis";

const WINDOW_SECONDS = 60;
const KEY_PREFIX = "clawmind:mcp:rate:";

type RateLimitResult =
  | { allowed: true; retryAfterSeconds: 0 }
  | { allowed: false; retryAfterSeconds: number };

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

export function getMcpClientId(request: Request): string | null {
  const clientId = request.headers.get("x-mcp-client-id")?.trim();

  if (!clientId) {
    return null;
  }

  return clientId;
}

export async function checkRateLimit(clientId: string): Promise<RateLimitResult> {
  const redis = await getRedis();

  if (redis) {
    const key = `${KEY_PREFIX}${clientId}`;
    const result = await redis.set(key, "1", "EX", WINDOW_SECONDS, "NX");

    if (result === "OK") {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
  }

  const now = Date.now();
  const expiresAt = localLimits.get(clientId) ?? 0;

  if (expiresAt > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((expiresAt - now) / 1_000),
    };
  }

  localLimits.set(clientId, now + WINDOW_SECONDS * 1_000);
  return { allowed: true, retryAfterSeconds: 0 };
}
