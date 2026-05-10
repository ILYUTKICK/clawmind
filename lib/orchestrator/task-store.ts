// ---------------------------------------------------------------------------
// ClawMind — Task Store for Async Pipeline (Vercel KV + in-memory fallback)
// ---------------------------------------------------------------------------
// On Vercel: uses Vercel KV (Redis) so task state persists across serverless
// function invocations. On local dev: falls back to an in-memory Map.
// If KV env vars are missing, gracefully falls back to in-memory.
// ---------------------------------------------------------------------------

import { AgentStep, AnalysisResult } from "@/lib/types";

export type TaskState = {
  taskId: string;
  task: string;
  status: "running" | "completed" | "failed";
  currentStep: string;
  steps: AgentStep[];
  result: AnalysisResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// KV helpers — try to use Vercel KV, fall back to in-memory Map
// ---------------------------------------------------------------------------

let kvAvailable = false;
let kvChecked = false;

async function getKv() {
  // If we already checked and KV is not available, skip immediately
  if (kvChecked && !kvAvailable) return null;
  // If we already checked and KV is available, import and return
  if (kvChecked && kvAvailable) {
    try {
      const { kv } = await import("@vercel/kv");
      return kv;
    } catch {
      kvAvailable = false;
      return null;
    }
  }

  // First-time check: try to import and verify env vars exist
  try {
    const { kv } = await import("@vercel/kv");
    // @vercel/kv throws if KV_REST_API_URL / KV_REST_API_TOKEN are missing.
    // Check for env vars BEFORE calling any kv method to avoid runtime errors.
    const hasUrl = !!process.env.KV_REST_API_URL;
    const hasToken = !!process.env.KV_REST_API_TOKEN;

    if (!hasUrl || !hasToken) {
      console.warn(
        "[TaskStore] KV_REST_API_URL or KV_REST_API_TOKEN not set — using in-memory fallback."
      );
      console.warn(
        "[TaskStore] To fix: add KV integration in Vercel dashboard or set env vars manually."
      );
      kvAvailable = false;
      kvChecked = true;
      return null;
    }

    kvAvailable = true;
    kvChecked = true;
    return kv;
  } catch {
    kvAvailable = false;
    kvChecked = true;
    return null;
  }
}

// In-memory fallback for local development
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

export async function createTask(taskId: string, task: string): Promise<TaskState> {
  const now = new Date().toISOString();
  const state: TaskState = {
    taskId,
    task,
    status: "running",
    currentStep: "initializing",
    steps: [],
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), {
        ex: TASK_TTL_SECONDS,
      });
    } catch (err) {
      console.warn("[TaskStore] KV set failed, using in-memory:", err);
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

  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), {
        ex: TASK_TTL_SECONDS,
      });
    } catch (err) {
      console.warn("[TaskStore] KV set failed, using in-memory:", err);
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

  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), {
        ex: TASK_TTL_SECONDS,
      });
    } catch (err) {
      console.warn("[TaskStore] KV set failed, using in-memory:", err);
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

  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(`${KV_KEY_PREFIX}${taskId}`, JSON.stringify(state), {
        ex: TASK_TTL_SECONDS,
      });
    } catch (err) {
      console.warn("[TaskStore] KV set failed, using in-memory:", err);
      memoryStore.set(taskId, state);
    }
  } else {
    memoryStore.set(taskId, state);
  }
}

export async function getTask(taskId: string): Promise<TaskState | undefined> {
  const kv = await getKv();
  if (kv) {
    try {
      const raw = await kv.get<string>(`${KV_KEY_PREFIX}${taskId}`);
      if (!raw) return undefined;
      try {
        if (typeof raw === "string") {
          return JSON.parse(raw) as TaskState;
        }
        return raw as unknown as TaskState;
      } catch {
        return undefined;
      }
    } catch (err) {
      console.warn("[TaskStore] KV get failed, using in-memory:", err);
      return memoryStore.get(taskId);
    }
  }

  return memoryStore.get(taskId);
}

export async function getLatestTask(): Promise<TaskState | undefined> {
  const kv = await getKv();
  if (kv) {
    return undefined;
  }

  const entries = [...memoryStore.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return entries[0];
}