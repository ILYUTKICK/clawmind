import assert from "node:assert/strict";
import test from "node:test";
import {
  checkAnalyzeRateLimit,
  resetAnalyzeRateLimitStateForTests,
} from "../../lib/rate-limit/analyze-rate-limit";

function createRequest(ip: string): Parameters<typeof checkAnalyzeRateLimit>[0] {
  return {
    headers: new Headers({
      "x-forwarded-for": ip,
    }),
  } as Parameters<typeof checkAnalyzeRateLimit>[0];
}

function withoutRedisEnv<T>(operation: () => T): T {
  const previousKvRedisUrl = process.env.KV_REDIS_URL;
  const previousRedisUrl = process.env.REDIS_URL;

  delete process.env.KV_REDIS_URL;
  delete process.env.REDIS_URL;

  try {
    return operation();
  } finally {
    process.env.KV_REDIS_URL = previousKvRedisUrl;
    process.env.REDIS_URL = previousRedisUrl;
  }
}

test("checkAnalyzeRateLimit blocks repeated requests from the same IP", async () => {
  await withoutRedisEnv(async () => {
    const previousWindow = process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS;
    process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS = "1";
    resetAnalyzeRateLimitStateForTests();

    try {
      const first = await checkAnalyzeRateLimit(createRequest("203.0.113.10"));
      const second = await checkAnalyzeRateLimit(createRequest("203.0.113.10"));
      const otherIp = await checkAnalyzeRateLimit(createRequest("203.0.113.11"));

      assert.equal(first.allowed, true);
      assert.equal(second.allowed, false);
      assert.equal(second.windowSeconds, 1);
      assert.ok(second.retryAfterSeconds >= 1);
      assert.equal(otherIp.allowed, true);
    } finally {
      process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS = previousWindow;
      resetAnalyzeRateLimitStateForTests();
    }
  });
});

test("checkAnalyzeRateLimit falls back to the default window for invalid env values", async () => {
  await withoutRedisEnv(async () => {
    const previousWindow = process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS;
    const previousWarn = console.warn;
    process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS = "not-a-number";
    console.warn = () => {};
    resetAnalyzeRateLimitStateForTests();

    try {
      const result = await checkAnalyzeRateLimit(createRequest("198.51.100.7"));

      assert.equal(result.allowed, true);
      assert.equal(result.windowSeconds, 60);
    } finally {
      process.env.CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS = previousWindow;
      console.warn = previousWarn;
      resetAnalyzeRateLimitStateForTests();
    }
  });
});
