import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/orchestrator/run-analysis";

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

    const result = await runAnalysis(body.task.trim());

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        error: "Failed to run analysis.",
        details: message,
      },
      { status: 500 }
    );
  }
}