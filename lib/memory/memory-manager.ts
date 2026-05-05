import { findRelevantMockMemories } from "@/lib/demo/mock-memory";
import { MemoryRecord } from "@/lib/types";

export async function getRelevantMemories(task: string): Promise<MemoryRecord[]> {
  return findRelevantMockMemories(task);
}

export function formatMemoryContext(memories: MemoryRecord[]): string {
  if (memories.length === 0) {
    return "No relevant memories found.";
  }

  return memories
    .map((memory) => {
      return [
        `Memory ID: ${memory.id}`,
        `Task: ${memory.task}`,
        `Summary: ${memory.summary}`,
        `Risks: ${memory.risks.join(", ")}`,
        `Recommendation: ${memory.recommendation}`,
        `Score: ${memory.score}`,
        `Storage URI: ${memory.storageUri || "not available"}`,
      ].join("\n");
    })
    .join("\n\n");
}