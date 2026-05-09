import { AnalysisReport, StorageReceipt } from "@/lib/types";
import { createHashLikeValue, getStorageConfig } from "@/lib/storage/zero-g-config";

type ZeroGUploadResult = {
  rootHash?: string;
  txHash?: string;
};

export async function saveReportToZeroGStorage(input: {
  task: string;
  report: AnalysisReport;
}): Promise<StorageReceipt> {
  const payload = {
    kind: "CLAWMIND_ANALYSIS_REPORT",
    version: "0.1",
    task: input.task,
    report: input.report,
    createdAt: new Date().toISOString(),
  };

  const serializedPayload = JSON.stringify(payload, null, 2);
  const localHash = createHashLikeValue(serializedPayload);
  const config = getStorageConfig();

  if (!config.isConfigured) {
    return {
      reportHash: localHash,
      storageUri: `local://clawmind/reports/${Date.now()}`,
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
      console.warn(`[0G Storage] upload failed: ${String(err)}`);

      return {
        reportHash: localHash,
        storageUri: `local://clawmind/reports/${Date.now()}`,
        provider: "LOCAL_FALLBACK",
        createdAt: new Date().toISOString(),
      };
    }

    const uploadResult = tx as ZeroGUploadResult;

    if (!uploadResult.rootHash) {
      console.warn("[0G Storage] upload succeeded but rootHash is missing.");

      return {
        reportHash: localHash,
        storageUri: `local://clawmind/reports/${Date.now()}`,
        provider: "LOCAL_FALLBACK",
        createdAt: new Date().toISOString(),
      };
    }

    return {
      reportHash: uploadResult.rootHash,
      storageUri: `0g://${uploadResult.rootHash}${
        uploadResult.txHash ? `?tx=${uploadResult.txHash}` : ""
      }`,
      provider: "0G_STORAGE",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.warn(`[0G Storage] exception: ${message}`);

    return {
      reportHash: localHash,
      storageUri: `local://clawmind/reports/${Date.now()}`,
      provider: "LOCAL_FALLBACK",
      createdAt: new Date().toISOString(),
    };
  }
}
