import { NextResponse } from "next/server";
import { getAllMemories } from "@/lib/memory/memory-manager";

export async function GET() {
  const memories = await getAllMemories();

  return NextResponse.json(
    {
      memories,
    },
    { status: 200 }
  );
}