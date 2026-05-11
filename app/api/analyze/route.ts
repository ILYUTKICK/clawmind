import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/orchestrator/run-analysis";
import {
  createTask,
  updateTaskStep,
  completeTask,
  failTask,
} from "@/lib/orchestrator/task-store";
import { AnalysisSource } from "@/lib/types";

// Vercel serverless function max duration (seconds)
// Hobby: 60s, Pro: 300s, Enterprise: 900s
export const maxDuration = 300;

function detectAnalysisSource(request: NextRequest, source: unknown): AnalysisSource {
  if (source === "mcp") {
    return "mcp";
  }

  const sourceHeader = request.headers.get("x-clawmind-source")?.toLowerCase();
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";

  if (sourceHeader === "mcp" || userAgent.includes("clawmind-mcp-server")) {
    return "mcp";
  }

  return "web";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { task?: unknown; source?: unknown };

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
    const source = detectAnalysisSource(request, body.source);
    const taskId = crypto.randomUUID();

    // Create task in store (KV or in-memory)
    await createTask(taskId, task, source);

    // Start pipeline in background — do NOT await it!
    const pipelinePromise = (async () => {
      try {
        const result = await runAnalysis(task, async (currentStep, steps) => {
          await updateTaskStep(taskId, currentStep, steps);
        }, { taskId, source });
        await completeTask(taskId, result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown pipeline error";
        console.error("[Analyze] Pipeline failed:", message);
        await failTask(taskId, message);
      }
    })();

    // On Vercel, use waitUntil to keep the function alive
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(pipelinePromise);
    } catch {
      // Not on Vercel — the promise still runs in the background on Node.js
      pipelinePromise.catch(() => {
        // Prevent unhandled rejection
      });
    }

    // Return taskId immediately — client will poll /api/status
    return NextResponse.json(
      { taskId, status: "running", source },
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
