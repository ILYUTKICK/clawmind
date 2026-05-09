import { NextRequest, NextResponse } from "next/server";
import { runAnalysis, checkManifestValid } from "@/lib/orchestrator/run-analysis";

export async function POST(request: NextRequest) {
  try {
    // ── Manifest validation gate ──
    // If openclaw.yaml is invalid, the pipeline MUST NOT start.
    const { valid, validation } = await checkManifestValid();

    if (!valid) {
      return NextResponse.json(
        {
          error: "OpenClaw manifest is invalid — pipeline cannot start.",
          manifestErrors: validation?.errors ?? [],
          manifestWarnings: validation?.warnings ?? [],
        },
        { status: 503 }
      );
    }

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
