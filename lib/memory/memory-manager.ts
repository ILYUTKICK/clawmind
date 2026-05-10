import { mockMemories } from "@/lib/demo/mock-memory";
import { AnalysisReport, MemoryRecord } from "@/lib/types";
import {
  appendPersistentMemory,
  readPersistentMemories,
} from "@/lib/memory/persistent-memory-store";
import {
  generateEmbedding,
  cosineSimilarity,
  keywordScore,
} from "@/lib/embeddings/embedding-provider";

type ScoredMemory = {
  memory: MemoryRecord;
  score: number;
};

function normalizeTaskForRelevance(task: string): string {
  return task
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function deduplicateRelevantMemories(memories: MemoryRecord[]): MemoryRecord[] {
  const seenKeys = new Set<string>();
  const deduplicated: MemoryRecord[] = [];

  for (const memory of memories) {
    const normalizedTask = normalizeTaskForRelevance(memory.task);
    const storageKey =
      memory.storageUri && memory.storageUri.trim().length > 0
        ? `storage:${memory.storageUri.trim()}`
        : "";

    const key =
      normalizedTask.length > 0
        ? `task:${normalizedTask}`
        : storageKey || `id:${memory.id}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(memory);
    }
  }

  return deduplicated;
}

export async function getAllMemories(): Promise<MemoryRecord[]> {
  const persistentMemories = await readPersistentMemories();

  const seenIds = new Set<string>();
  const allMemories: MemoryRecord[] = [];

  for (const memory of [...persistentMemories, ...mockMemories]) {
    if (!seenIds.has(memory.id)) {
      seenIds.add(memory.id);
      allMemories.push(memory);
    }
  }

  return deduplicateRelevantMemories(allMemories);
}

export async function getRelevantMemories(task: string): Promise<MemoryRecord[]> {
  const allMemories = await getAllMemories();

  // Try semantic (embedding-based) retrieval first
  if (allMemories.length > 0) {
    const taskEmbedResult = await generateEmbedding(task);

    if (taskEmbedResult) {
      // Semantic retrieval with cosine similarity
      const scoredMemories: ScoredMemory[] = [];

      for (const memory of allMemories) {
        let memoryEmbedding = memory.embedding;

        if (!memoryEmbedding || !Array.isArray(memoryEmbedding) || memoryEmbedding.length === 0) {
          const memoryEmbedResult = await generateEmbedding(
            [memory.task, memory.summary, ...memory.risks, memory.recommendation].join(" ")
          );
          memoryEmbedding = memoryEmbedResult?.embedding;
        }

        if (memoryEmbedding && memoryEmbedding.length > 0) {
          const similarity = cosineSimilarity(taskEmbedResult.embedding, memoryEmbedding);
          scoredMemories.push({
            memory: {
              ...memory,
              embedding: memoryEmbedding,
              similarityScore: similarity,
            },
            score: similarity,
          });
        }
      }

      if (scoredMemories.length > 0) {
        const sortedMemories = scoredMemories.sort((a, b) => b.score - a.score);
        const minSimilarity = taskEmbedResult.provider === "HASHED_FALLBACK" ? 0.05 : 0.3;
        const topMemories = sortedMemories
          .filter((item) => item.score > minSimilarity)
          .slice(0, 3)
          .map((item) => item.memory);

        if (topMemories.length > 0) {
          console.log(`[Memory] Semantic retrieval: top ${topMemories.length} memories (scores: ${sortedMemories.slice(0, 3).map(s => s.score.toFixed(2)).join(", ")})`);
          return deduplicateRelevantMemories(topMemories);
        }
      }

      // No good semantic matches, fall through to keyword matching
      console.log("[Memory] No strong semantic matches, using keyword fallback.");
    }
  }

  // Keyword-based fallback (works everywhere including Vercel)
  const scoredMemories: ScoredMemory[] = allMemories.map((memory) => ({
    memory,
    score: keywordScore(task, memory),
  }));

  const rankedMemories = scoredMemories
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.memory);

  const relevantMemories = deduplicateRelevantMemories(rankedMemories).slice(0, 3);

  if (relevantMemories.length > 0) {
    return relevantMemories;
  }

  return deduplicateRelevantMemories(allMemories).slice(0, 2);
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
        `Similarity: ${memory.similarityScore !== undefined ? memory.similarityScore.toFixed(2) : "not computed"}`,
        `Storage URI: ${memory.storageUri || "not available"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function saveGeneratedMemoryRecord(input: {
  task: string;
  report: AnalysisReport;
  storageUri?: string;
}): Promise<{
  memory: MemoryRecord;
  memories: MemoryRecord[];
}> {
  const createdAt = new Date().toISOString();

  // Generate embedding for the new memory (graceful fallback on Vercel)
  const embedResult = await generateEmbedding(
    [input.task, input.report.summary, input.report.risks.map(r => r.title).join(" ")].join(" ")
  );

  if (embedResult) {
    console.log(`[Memory] Generated embedding for new memory (dim=${embedResult.dim}, provider=${embedResult.provider})`);
  }

  const memory: MemoryRecord = {
    id: `mem_generated_${Date.now()}`,
    task: input.task,
    summary: input.report.summary,
    risks: input.report.risks.map((risk) => risk.title),
    recommendation: input.report.recommendation,
    score: input.report.score,
    storageUri: input.storageUri,
    embedding: embedResult?.embedding,
    createdAt,
  };

  const memories = await appendPersistentMemory(memory);

  return {
    memory,
    memories,
  };
}
