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
  provider: "ALL_MINILM_L6_V2" | "HASHED_FALLBACK";
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
      "[Embeddings] Vercel environment detected — trying local embedding model with hashed fallback."
    );
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
      "[Embeddings] Falling back to deterministic 384-dim hashed embeddings."
    );
    modelLoadFailed = true;
    return null;
  }
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeText(text: string): string[] {
  const stopWords = new Set([
    "this", "that", "with", "from", "into", "over", "under", "across",
    "protocol", "project", "analyze", "analysis", "agent", "system", "using",
    "uses", "while", "should", "would", "could", "about", "through", "between",
    "multiple", "the", "and", "for", "are", "will", "has", "have",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function generateHashedEmbedding(text: string): number[] {
  const dim = 384;
  const vector = new Array(dim).fill(0);
  const tokens = normalizeText(text);

  if (tokens.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const index = hashString(token) % dim;
    vector[index] += 1;

    if (i < tokens.length - 1) {
      const bigram = `${token}_${tokens[i + 1]}`;
      vector[hashString(bigram) % dim] += 0.5;
    }
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    vector[0] = 1;
    return vector;
  }

  return vector.map((value) => value / norm);
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
    const embedding = generateHashedEmbedding(text);
    return { embedding, dim: embedding.length, provider: "HASHED_FALLBACK" };
  }

  try {
    const embedding = await model.embed(text);
    return { embedding, dim: embedding.length, provider: "ALL_MINILM_L6_V2" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[Embeddings] Embedding generation failed: ${msg}`);
    const embedding = generateHashedEmbedding(text);
    return { embedding, dim: embedding.length, provider: "HASHED_FALLBACK" };
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

  return matchCount + riskBoost;
}

/**
 * Check if embeddings are available in the current environment.
 */
export function isEmbeddingAvailable(): boolean {
  return embedderInstance !== null || !modelLoadFailed;
}

/**
 * Semantic retrieval is active even when the transformer model is unavailable,
 * because the provider falls back to deterministic 384-dim hashed vectors and
 * still ranks memories with cosine similarity.
 */
export function isSemanticRetrievalActive(): boolean {
  return true;
}
