// ---------------------------------------------------------------------------
// ClawMind — Task Store for Async Pipeline (Redis via ioredis + in-memory fallback)
// ---------------------------------------------------------------------------
// On Vercel: uses Redis (KV_REDIS_URL) so task state persists across
// serverless function invocations. On local dev: falls back to in-memory Map.
// Uses ioredis which works with direct Redis URLs (redis://default:xxx@host:port).
// ---------------------------------------------------------------------------

import Redis from "ioredis";
import { AgentStep, AnalysisResult, AnalysisSource } from "@/lib/types";

export type TaskState = {
  taskId: string;
  task: string;
  source: AnalysisSource;
  status: "running" | "completed" | "failed";
  currentStep: string;
  steps: AgentStep[];
  result: AnalysisResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Redis client — lazy singleton
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedisUrl(): string {
  return (
    process.env.KV_REDIS_URL ||
    process.env.REDIS_URL ||
    ""
  );
}

async function getRedis(): Promise<Redis | null> {
  if (redisChecked) return redisClient;

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    console.warn("[TaskStore] No KV_REDIS_URL / REDIS_URL — using in-memory fallback.");
    redisChecked = true;
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
      // Don't retry forever on serverless — fail fast and fall back
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });

    await client.ping();
    console.log("[TaskStore] Connected via ioredis (KV_REDIS_URL)");
    redisClient = client;
    redisChecked = true;
    return redisClient;
  } catch (err) {
    console.warn("[TaskStore] ioredis connection failed:", err);
    console.warn("[TaskStore] Using in-memory fallback — task state will NOT persist across serverless invocations.");
    redisChecked = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback for local development
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, TaskState>();
const MAX_STORED_TASKS = 20;
const TASK_TTL_SECONDS = 600; // 10 minutes

function pruneOldTasks() {
  if (memoryStore.size <= MAX_STORED_TASKS) return;
  const entries = [...memoryStore.entries()].sort(
    (a, b) =>
      new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime()
  );
  const toDelete = entries.slice(0, entries.length - MAX_STORED_TASKS);
  for (const [key] of toDelete) {
    memoryStore.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const KV_KEY_PREFIX = "clawmind:task:";

export async function createTask(
  taskId: string,
  task: string,
  source: AnalysisSource = "web",
): Promise<TaskState> {
  const now = new Date().toISOString();
  const state: TaskState = {
    taskId,
    task,
    source,
    status: "running",
    currentStep: "initializing",
    steps: [],
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), "EX", TASK_TTL_SECONDS);
    } catch (err) {
      console.warn("[TaskStore] Redis set failed, using in-memory:", err);
      memoryStore.set(taskId, state);
      pruneOldTasks();
    }
  } else {
    memoryStore.set(taskId, state);
    pruneOldTasks();
  }

  return state;
}

export async function updateTaskStep(
  taskId: string,
  currentStep: string,
  steps: AgentStep[]
): Promise<void> {
  const state = await getTask(taskId);
  if (!state) return;

  state.currentStep = currentStep;
  state.steps = [...steps];
  state.updatedAt = new Date().toISOString();

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), "EX", TASK_TTL_SECONDS);
    } catch (err) {
      console.warn("[TaskStore] Redis set failed, using in-memory:", err);
      memoryStore.set(taskId, state);
    }
  } else {
    memoryStore.set(taskId, state);
  }
}

export async function completeTask(taskId: string, result: AnalysisResult): Promise<void> {
  const state = await getTask(taskId);
  if (!state) return;

  state.status = "completed";
  state.currentStep = "completed";
  state.result = result;
  state.steps = result.steps;
  state.updatedAt = new Date().toISOString();

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), "EX", TASK_TTL_SECONDS);
    } catch (err) {
      console.warn("[TaskStore] Redis set failed, using in-memory:", err);
      memoryStore.set(taskId, state);
    }
  } else {
    memoryStore.set(taskId, state);
  }
}

export async function failTask(taskId: string, error: string): Promise<void> {
  const state = await getTask(taskId);
  if (!state) return;

  state.status = "failed";
  state.currentStep = "failed";
  state.error = error;
  state.updatedAt = new Date().toISOString();

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), "EX", TASK_TTL_SECONDS);
    } catch (err) {
      console.warn("[TaskStore] Redis set failed, using in-memory:", err);
      memoryStore.set(taskId, state);
    }
  } else {
    memoryStore.set(taskId, state);
  }
}

export async function getTask(taskId: string): Promise<TaskState | undefined> {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(`${KV_KEY_PREFIX}${taskId}`);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as TaskState;
      } catch {
        return undefined;
      }
    } catch (err) {
      console.warn("[TaskStore] Redis get failed, using in-memory:", err);
      return memoryStore.get(taskId);
    }
  }

  return memoryStore.get(taskId);
}

export async function getLatestTask(): Promise<TaskState | undefined> {
  const redis = await getRedis();
  if (redis) {
    // Redis doesn't support listing by prefix easily without SCAN
    // Return undefined — the client always polls by taskId anyway
    return undefined;
  }

  const entries = [...memoryStore.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return entries[0];
}
