import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/orchestrator/run-analysis";
import {
  createTask,
  updateTaskStep,
  completeTask,
  failTask,
} from "@/lib/orchestrator/task-store";

// Vercel serverless function max duration (seconds)
// Hobby: 60s, Pro: 300s, Enterprise: 900s
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { task?: unknown };

    if (typeof body.task !== "string" || body.task.trim().length < 10) {
      return NextResponse.json(
        {
          error:
            "Task must be a string with at least 10 characters. Please describe the Web3/AI project you want to analyze.",
        },
        { status: 400 }
      );
    }

    const task = body.task.trim();
    const taskId = crypto.randomUUID();

    // Create task in store
    createTask(taskId, task);

    // Start pipeline in background — do NOT await it!
    // The pipeline will update taskStore as it progresses.
    const pipelinePromise = runAnalysis(task, (currentStep, steps) => {
      updateTaskStep(taskId, currentStep, steps);
    })
      .then((result) => {
        completeTask(taskId, result);
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Unknown pipeline error";
        console.error("[Analyze] Pipeline failed:", message);
        failTask(taskId, message);
      });

    // On Vercel, use waitUntil to keep the function alive
    // On local dev, the event loop keeps it running as long as there are pending promises
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(pipelinePromise);
    } catch {
      // Not on Vercel — the promise still runs in the background on Node.js
      // because the server keeps the event loop alive
      pipelinePromise.catch(() => {
        // Prevent unhandled rejection
      });
    }

    // Return taskId immediately — client will poll /api/status
    return NextResponse.json(
      { taskId, status: "running" },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        error: "Failed to start analysis.",
        details: message,
      },
      { status: 500 }
    );
  }
}