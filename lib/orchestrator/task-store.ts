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

const taskStore = new Map<string, TaskState>();
const MAX_STORED_TASKS = 20;

function pruneOldTasks() {
  if (taskStore.size <= MAX_STORED_TASKS) return;
  const entries = [...taskStore.entries()].sort(
    (a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime()
  );
  const toDelete = entries.slice(0, entries.length - MAX_STORED_TASKS);
  for (const [key] of toDelete) taskStore.delete(key);
}

export function createTask(taskId: string, task: string): TaskState {
  const now = new Date().toISOString();
  const state: TaskState = {
    taskId, task, status: "running", currentStep: "initializing",
    steps: [], result: null, error: null, createdAt: now, updatedAt: now,
  };
  taskStore.set(taskId, state);
  pruneOldTasks();
  return state;
}

export function updateTaskStep(taskId: string, currentStep: string, steps: AgentStep[]): void {
  const state = taskStore.get(taskId);
  if (!state) return;
  state.currentStep = currentStep;
  state.steps = [...steps];
  state.updatedAt = new Date().toISOString();
}

export function completeTask(taskId: string, result: AnalysisResult): void {
  const state = taskStore.get(taskId);
  if (!state) return;
  state.status = "completed";
  state.currentStep = "completed";
  state.result = result;
  state.steps = result.steps;
  state.updatedAt = new Date().toISOString();
}

export function failTask(taskId: string, error: string): void {
  const state = taskStore.get(taskId);
  if (!state) return;
  state.status = "failed";
  state.currentStep = "failed";
  state.error = error;
  state.updatedAt = new Date().toISOString();
}

export function getTask(taskId: string): TaskState | undefined {
  return taskStore.get(taskId);
}

export function getLatestTask(): TaskState | undefined {
  const entries = [...taskStore.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return entries[0];
}