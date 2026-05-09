// ---------------------------------------------------------------------------
// ClawMind — Analysis Result Cache
// ---------------------------------------------------------------------------
// Provides deterministic reproducibility: the same task + memory snapshot
// produces the same result within the cache TTL (5 minutes).
//
// How it works:
//   1. Hash the task text + relevant memory IDs → cache key
//   2. If a cached result exists and is fresh (< 5 min), return it
//   3. Otherwise, run the full pipeline and store the result
//
// The "Force fresh analysis" checkbox in the UI sets forceFresh=true
// to bypass the cache entirely.
// ---------------------------------------------------------------------------

import { createHash } from "crypto";
import type { AnalysisResult } from "@/lib/types";

// In-memory cache (resets on server restart — acceptable for a hackathon demo)
const cache = new Map<string, { result: AnalysisResult; cachedAt: number; taskHash: string }>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Maximum cache entries (prevent memory leaks)
const MAX_CACHE_SIZE = 100;

/**
 * Build a cache key from the task text and memory snapshot.
 * The key is deterministic: same task + same memories = same key.
 */
export function buildCacheKey(task: string, memoryIds: string[]): string {
  const normalizedTask = task.trim().toLowerCase();
  const sortedMemoryIds = [...memoryIds].sort();
  const raw = JSON.stringify({ task: normalizedTask, memories: sortedMemoryIds });
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Look up a cached analysis result.
 * Returns null if not found or if the entry has expired.
 */
export function getCachedAnalysis(
  cacheKey: string,
  forceFresh: boolean = false
): { result: AnalysisResult; cachedAt: number; taskHash: string } | null {
  if (forceFresh) {
    return null;
  }

  const entry = cache.get(cacheKey);
  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL_MS) {
    cache.delete(cacheKey);
    return null;
  }

  console.log(
    `[Cache] HIT — key=${cacheKey.slice(0, 12)}... age=${Math.round(age / 1000)}s`
  );

  return entry;
}

/**
 * Store an analysis result in the cache.
 * Evicts the oldest entry if the cache is full.
 */
export function setCachedAnalysis(
  cacheKey: string,
  result: AnalysisResult
): void {
  // Evict oldest if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.cachedAt < oldestTime) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(cacheKey, {
    result,
    cachedAt: Date.now(),
    taskHash: cacheKey,
  });

  console.log(
    `[Cache] STORED — key=${cacheKey.slice(0, 12)}... entries=${cache.size}`
  );
}

/**
 * Get cache stats for the /api/status endpoint.
 */
export function getCacheStats(): {
  size: number;
  maxEntries: number;
  ttlMs: number;
} {
  return {
    size: cache.size,
    maxEntries: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}

/**
 * Clear the entire cache (for testing or admin purposes).
 */
export function clearCache(): void {
  cache.clear();
  console.log("[Cache] CLEARED");
}
