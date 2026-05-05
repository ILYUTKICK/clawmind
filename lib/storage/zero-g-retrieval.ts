import { AnalysisReport } from "@/lib/types";

type StoredClawMindReport = {
  kind: "CLAWMIND_ANALYSIS_REPORT";
  version: string;
  task: string;
  report: AnalysisReport;
  createdAt: string;
};

export type RetrievedReportResult = {
  rootHash: string;
  storageUri: string;
  task: string;
  report: AnalysisReport;
  createdAt: string;
  raw: StoredClawMindReport;
};

function getStorageIndexerRpc(): string {
  return (
    process.env.ZERO_G_STORAGE_INDEXER_RPC ||
    "https://indexer-storage-testnet-turbo.0g.ai"
  );
}

export function extractRootHash(input: string): string {
  const trimmedInput = input.trim();

  if (trimmedInput.length === 0) {
    throw new Error("Storage URI or root hash is required.");
  }

  if (trimmedInput.startsWith("0g://")) {
    const withoutScheme = trimmedInput.replace("0g://", "");
    const rootHash = withoutScheme.split("?")[0]?.trim();

    if (!rootHash) {
      throw new Error("Invalid 0G storage URI.");
    }

    return rootHash;
  }

  const withoutQuery = trimmedInput.split("?")[0]?.trim();

  if (!withoutQuery) {
    throw new Error("Invalid root hash.");
  }

  return withoutQuery;
}

function isStoredClawMindReport(value: unknown): value is StoredClawMindReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredClawMindReport>;

  return (
    candidate.kind === "CLAWMIND_ANALYSIS_REPORT" &&
    typeof candidate.version === "string" &&
    typeof candidate.task === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.report === "object" &&
    candidate.report !== null
  );
}

export async function retrieveReportFromZeroGStorage(
  storageUriOrRootHash: string
): Promise<RetrievedReportResult> {
  const rootHash = extractRootHash(storageUriOrRootHash);
  const indexerRpc = getStorageIndexerRpc();

  const url = `${indexerRpc.replace(/\/$/, "")}/file?root=${encodeURIComponent(
    rootHash
  )}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `0G Storage retrieval failed with status ${response.status}: ${response.statusText}`
    );
  }

  const text = await response.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Retrieved file is not valid JSON.");
  }

  if (!isStoredClawMindReport(parsed)) {
    throw new Error(
      "Retrieved file is not a valid ClawMind analysis report."
    );
  }

  return {
    rootHash,
    storageUri: `0g://${rootHash}`,
    task: parsed.task,
    report: parsed.report,
    createdAt: parsed.createdAt,
    raw: parsed,
  };
}