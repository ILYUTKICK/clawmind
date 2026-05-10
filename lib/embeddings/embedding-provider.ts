// ---------------------------------------------------------------------------
// ClawMind — Embedding Provider (with Vercel-compatible fallback)
// ---------------------------------------------------------------------------
// On local machines: Uses @xenova/transformers for real semantic embeddings.
// On Vercel/serverless: Falls back to keyword-based matching gracefully.
// ---------------------------------------------------------------------------

import { MemoryRecord } from "@/lib/types";

type EmbeddingResult = {
  embedding: number[];
  dim: number;
};

// Cache for the loaded model
let embedderInstance: {
  embed(text: string): Promise<number[]>;
} | null = null;
let isVercelEnvironment = false;
let modelLoadAttempted = false;
let modelLoadFailed = false;

/**
 * Detect if we're running on Vercel serverless.
 */
function detectVercel(): boolean {
  return (
    process.env.VERCEL === "1" ||
    !!process.env.VERCEL_URL ||
    !!process.env.NOW_REGION
  );
}

/**
 * Try to load @xenova/transformers embedding model.
 * Returns null if not available (Vercel, missing deps, etc.)
 */
async function tryLoadEmbeddingModel(): Promise<{
  embed(text: string): Promise<number[]>;
} | null> {
  if (modelLoadFailed || (modelLoadAttempted && embedderInstance)) {
    return embedderInstance;
  }

  modelLoadAttempted = true;
  isVercelEnvironment = detectVercel();

  if (isVercelEnvironment) {
    console.log(
      "[Embeddings] Vercel environment detected — skipping native ONNX Runtime model loading."
    );
    console.log(
      "[Embeddings] Using keyword-based memory matching fallback instead."
    );
    modelLoadFailed = true;
    return null;
  }

  try {
    const { pipeline } = await import("@xenova/transformers");
    console.log(
      "[Embeddings] Loading all-MiniLM-L6-v2 model (first call, ~1-2s)..."
    );

    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { quantized: true }
    );

    embedderInstance = {
      async embed(text: string): Promise<number[]> {
        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        return Array.from(output.data) as number[];
      },
    };

    console.log("[Embeddings] Model loaded successfully (384 dimensions)");
    return embedderInstance;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[Embeddings] Failed to load model: ${msg}`);
    console.warn(
      "[Embeddings] Falling back to keyword-based memory matching."
    );
    modelLoadFailed = true;
    return null;
  }
}

/**
 * Generate embedding for a text string.
 * Returns null if embeddings are unavailable (Vercel, etc.)
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult | null> {
  const model = await tryLoadEmbeddingModel();

  if (!model) {
    return null;
  }

  try {
    const embedding = await model.embed(text);
    return { embedding, dim: embedding.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[Embeddings] Embedding generation failed: ${msg}`);
    return null;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Keyword-based scoring fallback for when embeddings are unavailable.
 */
export function keywordScore(task: string, memory: MemoryRecord): number {
  const normalizeText = (text: string): string =>
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");

  const stopWords = new Set([
    "this", "that", "with", "from", "into", "over", "under", "across",
    "protocol", "project", "analyze", "agent", "system", "using", "uses",
    "while", "should", "would", "could", "about", "through", "between",
    "multiple",
  ]);

  const keywords = normalizeText(task)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  const searchableText = normalizeText(
    [memory.task, memory.summary, memory.recommendation, ...memory.risks].join(
      " "
    )
  );

  const matchCount = keywords.filter((kw) => searchableText.includes(kw)).length;
  const riskBoost = memory.risks.some((risk) =>
    normalizeText(task).includes(normalizeText(risk))
  )
    ? 3
    : 0;
  const storageBoost = memory.storageUri?.startsWith("0g://") ? 1 : 0;

  return matchCount + riskBoost + storageBoost;
}

/**
 * Check if embeddings are available in the current environment.
 */
export function isEmbeddingAvailable(): boolean {
  return embedderInstance !== null;
}
