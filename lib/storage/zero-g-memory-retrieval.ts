import { MemoryRecord } from "@/lib/types";
import { extractRootHash } from "@/lib/storage/zero-g-retrieval";
import { getNetworkConfig } from "@/lib/storage/zero-g-config";

type StoredClawMindMemoryIndex = {
  kind: "CLAWMIND_MEMORY_INDEX";
  version?: string;
  schemaVersion?: string;
  snapshotVersion?: number;
  previousSnapshotUri?: string | null;
  memories: MemoryRecord[];
  createdAt: string;
};

export type RetrievedMemoryIndexResult = {
  rootHash: string;
  storageUri: string;
  memories: MemoryRecord[];
  createdAt: string;
  raw: StoredClawMindMemoryIndex;
};

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<MemoryRecord>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.task === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.risks) &&
    candidate.risks.every((risk) => typeof risk === "string") &&
    typeof candidate.recommendation === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.createdAt === "string"
  );
}

function isStoredClawMindMemoryIndex(value: unknown): value is StoredClawMindMemoryIndex {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredClawMindMemoryIndex>;

  // Accept both old format (version) and new format (schemaVersion)
  const hasValidVersion = typeof candidate.version === "string" || typeof candidate.schemaVersion === "string";

  return (
    candidate.kind === "CLAWMIND_MEMORY_INDEX" &&
    hasValidVersion &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.memories) &&
    candidate.memories.every(isMemoryRecord)
  );
}

export async function retrieveMemoryIndexFromZeroGStorage(
  storageUriOrRootHash: string,
): Promise<RetrievedMemoryIndexResult> {
  const rootHash = extractRootHash(storageUriOrRootHash);
  const { indexerRpc } = getNetworkConfig();
  const url = `${indexerRpc.replace(/\/$/, "")}/file?root=${encodeURIComponent(rootHash)}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`0G memory index retrieval failed with status ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Retrieved memory index is not valid JSON.");
  }

  if (!isStoredClawMindMemoryIndex(parsed)) {
    throw new Error("Retrieved file is not a valid ClawMind memory index.");
  }

  return {
    rootHash,
    storageUri: `0g://${rootHash}`,
    memories: parsed.memories,
    createdAt: parsed.createdAt,
    raw: parsed,
  };
}
