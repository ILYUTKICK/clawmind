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
  isEmbeddingAvailable,
} from "@/lib/embeddings/embedding-provider";

type ScoredMemory = {
  memory: MemoryRecord;
  score: number;
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "this",
    "that",
    "with",
    "from",
    "into",
    "over",
    "under",
    "across",
    "protocol",
    "project",
    "analyze",
    "agent",
    "system",
    "using",
    "uses",
    "while",
    "should",
    "would",
    "could",
    "about",
    "through",
    "between",
    "multiple",
  ]);

  return normalizeText(text)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .filter((word) => !stopWords.has(word));
}

function scoreMemory(task: string, memory: MemoryRecord): number {
  const keywords = extractKeywords(task);

  const searchableMemoryText = normalizeText(
    [
      memory.task,
      memory.summary,
      memory.recommendation,
      String(memory.score),
      memory.storageUri ?? "",
      ...memory.risks,
    ].join(" "),
  );

  const keywordScore = keywords.reduce((total, keyword) => {
    return searchableMemoryText.includes(keyword) ? total + 1 : total;
  }, 0);

  const riskBoost = memory.risks.some((risk) => {
    return normalizeText(task).includes(normalizeText(risk));
  })
    ? 3
    : 0;

  const storageBoost = memory.storageUri?.startsWith("0g://") ? 1 : 0;

  return keywordScore + riskBoost + storageBoost;
}

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
        // Use stored embedding if available, otherwise skip semantic scoring
        if (memory.embedding && Array.isArray(memory.embedding) && memory.embedding.length > 0) {
          const similarity = cosineSimilarity(taskEmbedResult.embedding, memory.embedding);
          scoredMemories.push({ memory, score: similarity });
        }
      }

      if (scoredMemories.length > 0) {
        const topMemories = scoredMemories
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.score > 0.5)
          .slice(0, 3)
          .map((item) => item.memory);

        if (topMemories.length > 0) {
          console.log(`[Memory] Semantic retrieval: top ${topMemories.length} memories (scores: ${scoredMemories.slice(0, 3).map(s => s.score.toFixed(2)).join(", ")})`);
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
    console.log(`[Memory] Generated embedding for new memory (dim=${embedResult.dim})`);
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