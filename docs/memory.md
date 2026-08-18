# Memory

ClawMind uses semantic memory so previous analyses can influence future reasoning.

The memory subsystem is separate from the core agents and currently includes:

```text
lib/memory/
├── embeddings.ts
├── memory-manager.ts
└── persistent-memory-store.ts

lib/embeddings/
└── ...
```

## Memory Lifecycle

```text
Previous Analyses
       |
       v
  Persistent Store
       |
       v
   Embeddings
       |
       v
Semantic Retrieval
       |
       v
Relevant Context
       |
       v
     Planner
       |
       v
   Agent Pipeline
       |
       v
  Memory Writer
       |
       v
Persistent Store
```

---

## Embeddings

The semantic memory module uses `@xenova/transformers`.

Current local embedding model:

```text
all-MiniLM-L6-v2
```

Vector size:

```text
384 dimensions
```

Similarity method:

```text
cosine similarity
```

The model is lazy-loaded on first use and cached in memory for the lifetime of the process.

This keeps subsequent embedding calls cheaper than the initial cold start.

---

## Hybrid Retrieval

The memory manager imports both:

```text
generateEmbedding
cosineSimilarity
keywordScore
```

This allows the retrieval layer to use semantic similarity while retaining a lexical fallback/signal.

A memory result is represented as a record plus a retrieval score.

---

## Persistent Memory

The persistent store supports Redis-backed state and a stored memory index.

Current Redis keys include:

```text
clawmind:memory:records
clawmind:memory:latest-index-uri
```

The store can also retrieve a memory index from 0G Storage.

The default in-process memory limit is currently:

```text
200 records
```

This limit can be configured through the application environment.

---

## What Gets Retrieved

The retrieval stage is intended to surface prior analyses that are relevant to a new task.

The returned text becomes `memoryContext`, which is used by:

- Planner
- Risk Agent

and can influence downstream reasoning through their outputs.

---

## Why Memory Is Written Back

Without write-back, semantic memory would remain a static seed set.

The runtime can append newly generated knowledge so the system gradually accumulates examples of:

- previous decisions;
- recurring risks;
- prior architecture findings;
- domain-specific patterns.

This creates the loop:

```text
Retrieve -> Reason -> Evaluate -> Store -> Retrieve
```

---

## Memory Warm-Up

The repository includes:

```bash
npm run warm-memory
```

Useful variants:

```bash
npm run warm-memory -- --limit 10
npm run warm-memory -- --prod --limit 5
```

The warm-up script is intended for curated tasks, not random prompts.

In production mode, runs can consume real compute, storage, and chain resources. Keep production batches intentionally small.

---

## Failure Modes

### Embedding model unavailable

Semantic retrieval should degrade rather than block the entire analysis flow.

### Redis unavailable

The implementation includes non-Redis/fallback persistence paths so the application can still operate in limited environments.

### Poor historical memory

Memory retrieval can reinforce bad prior conclusions.

For that reason, memory quality should be treated as an evaluation problem, not just a storage problem.

---

## Evaluation Ideas

Useful memory-specific tests include:

1. **Repeat-task retrieval**
   - run a task;
   - store the result;
   - submit a semantically similar task;
   - confirm that the earlier memory ranks near the top.

2. **Irrelevant-memory resistance**
   - populate memory with unrelated tasks;
   - confirm that lexical noise does not dominate a semantically relevant record.

3. **Bad-memory robustness**
   - inject intentionally poor records;
   - measure whether retrieval quality or final recommendations degrade.

4. **Cold-start behavior**
   - run with no persistent memory;
   - confirm the pipeline still completes.

5. **Persistence**
   - restart the application;
   - confirm stored memory remains retrievable.
