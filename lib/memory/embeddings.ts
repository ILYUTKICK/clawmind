// ---------------------------------------------------------------------------
// ClawMind — Embedding Module for Semantic Memory Retrieval
// ---------------------------------------------------------------------------
// Uses @xenova/transformers with all-MiniLM-L6-v2 (384-dim vectors)
// for embedding-based semantic similarity retrieval.
//
// Model: all-MiniLM-L6-v2 (22MB, 384 dimensions)
// Method: Cosine similarity for top-k retrieval
//
// Cold start: ~1-2 seconds for model loading on first call.
// Subsequent calls: ~50-100ms per embedding.
// ---------------------------------------------------------------------------

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: ArrayLike<number> }>;

let pipeline: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Initialize the embedding pipeline (lazy-loaded on first call).
 * The model is cached in memory for the lifetime of the process.
 */
async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (pipeline) return pipeline;

  if (loadingPromise) return loadingPromise;

  console.log("[Embeddings] Loading all-MiniLM-L6-v2 model (first call, ~1-2s)...");

  loadingPromise = (async () => {
    try {
      // Dynamic import to avoid bundling issues in client-side
      const { pipeline: createPipeline } = (await import("@xenova/transformers")) as {
        pipeline: (
          task: "feature-extraction",
          model: string,
          options: { quantized: boolean }
        ) => Promise<FeatureExtractionPipeline>;
      };
      const embedder = await createPipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { quantized: true }
      );
      pipeline = embedder;
      console.log("[Embeddings] Model loaded successfully (384 dimensions)");
      return embedder;
    } catch (error) {
      loadingPromise = null; // Reset so we can retry
      console.error("[Embeddings] Failed to load model:", error);
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Generate an embedding vector for a text string.
 * Returns a 384-dimensional number array.
 *
 * @param text - The text to embed
 * @returns number[] - 384-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const pipe = await getPipeline();

    const result = await pipe(text, {
      pooling: "mean",
      normalize: true,
    });

    // Convert tensor to regular array
    const embedding = Array.from(result.data) as number[];

    return embedding;
  } catch (error) {
    console.error("[Embeddings] Failed to generate embedding:", error);
    // Return zero vector as fallback (384 dimensions)
    return new Array(384).fill(0);
  }
}

/**
 * Generate embeddings for multiple texts in batch.
 * More efficient than calling generateEmbedding individually.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await generateEmbedding(text));
  }
  return embeddings;
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1, where 1 = identical.
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

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find the top-k most similar items from a set of candidates.
 *
 * @param queryEmbedding - The query vector
 * @param candidates - Array of { id, embedding, ...metadata }
 * @param k - Number of results to return
 * @returns Array of candidates sorted by similarity (descending), with similarityScore added
 */
export function findTopK<T extends { embedding?: number[] }>(
  queryEmbedding: number[],
  candidates: T[],
  k: number = 3
): Array<T & { similarityScore: number }> {
  const scored = candidates
    .filter((c) => c.embedding && c.embedding.length > 0)
    .map((c) => ({
      ...c,
      similarityScore: cosineSimilarity(queryEmbedding, c.embedding!),
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, k);

  return scored;
}

/**
 * Check if the embedding model is loaded and ready.
 */
export function isEmbeddingReady(): boolean {
  return pipeline !== null;
}
