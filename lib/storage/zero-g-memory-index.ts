// ---------------------------------------------------------------------------
// ClawMind — Memory Index Persistence to 0G Storage
// ---------------------------------------------------------------------------
// Each memory index upload is a NEW version with a NEW 0g:// URI.
// This guarantees memory state immutability: previous snapshots are never
// overwritten — they remain accessible via their unique 0g:// URIs.
//
// Versioning:
//   - Each snapshot gets an incrementing snapshotVersion number
//   - The payload includes previousSnapshotUri for chain-of-custody
//   - The embedding model and dimensions are recorded in the payload
// ---------------------------------------------------------------------------

import { MemoryRecord, StorageReceipt } from "@/lib/types";
import { createHashLikeValue, getStorageConfig } from "@/lib/storage/zero-g-config";

type ZeroGUploadResult = {
  rootHash?: string;
  txHash?: string;
};

type MemoryIndexPayload = {
  kind: "CLAWMIND_MEMORY_INDEX";
  /** Schema version (incremented on breaking changes) */
  schemaVersion: "2.0";
  /** Incrementing snapshot number (each upload = +1) */
  snapshotVersion: number;
  /** URI of the previous snapshot (chain-of-custody) */
  previousSnapshotUri: string | null;
  /** When this snapshot was created */
  createdAt: string;
  /** The memory records with embeddings */
  memories: MemoryRecord[];
  /** Embedding metadata */
  embedding: {
    model: string;
    dimensions: number;
    retrievalMethod: string;
  };
};

// Track the current snapshot version in memory
let currentSnapshotVersion = 0;
let lastSnapshotUri: string | null = null;

/**
 * Update the snapshot tracking after a successful save.
 */
export function updateSnapshotTracking(uri: string | null): void {
  if (uri) {
    lastSnapshotUri = uri;
    currentSnapshotVersion += 1;
  }
}

/**
 * Get the current snapshot version number.
 */
export function getCurrentSnapshotVersion(): number {
  return currentSnapshotVersion;
}

/**
 * Get the last snapshot URI.
 */
export function getLastSnapshotUri(): string | null {
  return lastSnapshotUri;
}

export async function saveMemoryIndexToZeroGStorage(input: {
  memories: MemoryRecord[];
}): Promise<StorageReceipt> {
  const snapshotVersion = currentSnapshotVersion + 1;

  const payload: MemoryIndexPayload = {
    kind: "CLAWMIND_MEMORY_INDEX",
    schemaVersion: "2.0",
    snapshotVersion,
    previousSnapshotUri: lastSnapshotUri,
    createdAt: new Date().toISOString(),
    memories: input.memories,
    embedding: {
      model: "all-MiniLM-L6-v2",
      dimensions: 384,
      retrievalMethod: "cosine_similarity_top_k",
    },
  };

  const serializedPayload = JSON.stringify(payload, null, 2);
  const localHash = createHashLikeValue(serializedPayload);
  const config = getStorageConfig();

  if (!config.isConfigured) {
    // Still update snapshot tracking for local fallback
    const localUri = `local://clawmind/memory-index/v${snapshotVersion}/${Date.now()}`;
    updateSnapshotTracking(localUri);

    return {
      reportHash: localHash,
      storageUri: localUri,
      provider: "LOCAL_FALLBACK",
      createdAt: new Date().toISOString(),
    };
  }

  try {
    const [{ Indexer, MemData }, { ethers }] = await Promise.all([
      import("@0gfoundation/0g-storage-ts-sdk"),
      import("ethers"),
    ]);

    const provider = new ethers.JsonRpcProvider(config.evmRpc);
    const signer = new ethers.Wallet(config.privateKey as string, provider);
    const indexer = new Indexer(config.indexerRpc);

    const bytes = new TextEncoder().encode(serializedPayload);
    const memData = new MemData(bytes);

    const [tx, err] = await indexer.upload(
      memData,
      config.evmRpc,
      signer as never
    );

    if (err !== null) {
      console.warn(`[0G Memory Index] upload failed: ${String(err)}`);

      const localUri = `local://clawmind/memory-index/v${snapshotVersion}/${Date.now()}`;
      updateSnapshotTracking(localUri);

      return {
        reportHash: localHash,
        storageUri: localUri,
        provider: "LOCAL_FALLBACK",
        createdAt: new Date().toISOString(),
      };
    }

    const uploadResult = tx as ZeroGUploadResult;

    if (!uploadResult.rootHash) {
      console.warn(
        "[0G Memory Index] upload succeeded but rootHash is missing."
      );

      const localUri = `local://clawmind/memory-index/v${snapshotVersion}/${Date.now()}`;
      updateSnapshotTracking(localUri);

      return {
        reportHash: localHash,
        storageUri: localUri,
        provider: "LOCAL_FALLBACK",
        createdAt: new Date().toISOString(),
      };
    }

    const storageUri = `0g://${uploadResult.rootHash}${
      uploadResult.txHash ? `?tx=${uploadResult.txHash}` : ""
    }`;

    // Update snapshot tracking
    updateSnapshotTracking(storageUri);

    console.log(
      `[0G Memory Index] Snapshot v${snapshotVersion} saved → ${storageUri}`
    );

    return {
      reportHash: uploadResult.rootHash,
      storageUri,
      provider: "0G_STORAGE",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.warn(`[0G Memory Index] exception: ${message}`);

    const localUri = `local://clawmind/memory-index/v${snapshotVersion}/${Date.now()}`;
    updateSnapshotTracking(localUri);

    return {
      reportHash: localHash,
      storageUri: localUri,
      provider: "LOCAL_FALLBACK",
      createdAt: new Date().toISOString(),
    };
  }
}
