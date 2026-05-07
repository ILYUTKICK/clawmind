import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const manifestPath = path.join(process.cwd(), "openclaw.yaml");
    const manifest = await fs.readFile(manifestPath, "utf-8");

    return new NextResponse(manifest, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=\"openclaw.yaml\"",
        },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while reading OpenClaw manifest.";

    return NextResponse.json(
      {
        error: "OpenClaw manifest could not be loaded.",
        details: message,
      },
      {
        status: 500,
      },
    );
  }
}