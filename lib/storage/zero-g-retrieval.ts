import fs from "fs";
import path from "path";
import { AnalysisReport } from "@/lib/types";
import { getNetworkConfig } from "@/lib/storage/zero-g-config";

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
  const { indexerRpc } = getNetworkConfig();

  // ─── ФИКС: используем SDK download вместо HTTP fetch ───
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(indexerRpc);

  const tmpFile = path.join("/tmp", `report-${Date.now()}.json`);

  const err = await indexer.download(rootHash, tmpFile, false);
  if (err !== null) {
    throw new Error(`0G Storage download failed: ${String(err)}`);
  }

  const text = fs.readFileSync(tmpFile, "utf-8");
  fs.unlinkSync(tmpFile);
  // ────────────────────────────────────────────────────────

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Retrieved file is not valid JSON.");
  }

  if (!isStoredClawMindReport(parsed)) {
    throw new Error("Retrieved file is not a valid ClawMind analysis report.");
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