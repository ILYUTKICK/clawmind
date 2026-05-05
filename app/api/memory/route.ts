import { NextResponse } from "next/server";
import { mockMemories } from "@/lib/demo/mock-memory";

export async function GET() {
  return NextResponse.json(
    {
      memories: mockMemories,
    },
    { status: 200 }
  );
}