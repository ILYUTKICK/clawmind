import { NextRequest, NextResponse } from "next/server";
import { retrieveReportFromZeroGStorage } from "@/lib/storage/zero-g-retrieval";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      storageUriOrRootHash?: unknown;
    };

    if (
      typeof body.storageUriOrRootHash !== "string" ||
      body.storageUriOrRootHash.trim().length < 10
    ) {
      return NextResponse.json(
        {
          error:
            "storageUriOrRootHash must be a valid 0G storage URI or root hash.",
        },
        { status: 400 }
      );
    }

    const result = await retrieveReportFromZeroGStorage(
      body.storageUriOrRootHash
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown retrieval error";

    return NextResponse.json(
      {
        error: "Failed to retrieve report from 0G Storage.",
        details: message,
      },
      { status: 500 }
    );
  }
}