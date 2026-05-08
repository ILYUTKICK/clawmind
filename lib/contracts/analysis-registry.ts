// ---------------------------------------------------------------------------
// ClawMind — On-chain Analysis Registry integration for 0G chain
// ---------------------------------------------------------------------------

import { getNetworkConfig, getExplorerTxUrl } from "@/lib/storage/zero-g-config";
import type { OnChainReceipt } from "@/lib/types";

// ---------------------------------------------------------------------------
// ABI — only the functions and events we need
// ---------------------------------------------------------------------------

export const ANALYSIS_REGISTRY_ABI = [
  "function recordAnalysis(bytes32 rootHash, string calldata storageUri, uint8 score, string calldata recommendation) external returns (uint256)",
  "function getAnalysis(uint256 analysisId) external view returns (address submitter, bytes32 rootHash, string memory storageUri, uint8 score, string memory recommendation, uint256 timestamp)",
  "function isRootHashRegistered(bytes32 rootHash) external view returns (bool)",
  "function getLatestAnalysis() external view returns (address submitter, bytes32 rootHash, string memory storageUri, uint8 score, string memory recommendation, uint256 timestamp)",
  "function analysisCount() external view returns (uint256)",
  "event AnalysisRecorded(uint256 indexed analysisId, address indexed submitter, bytes32 rootHash, uint8 score, string recommendation, string storageUri, uint256 timestamp)",
] as const;

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/** Placeholder strings that indicate a private key has not been set. */
const PLACEHOLDER_PRIVATE_KEYS = new Set([
  "your_wallet_private_key_here",
  "your_testnet_wallet_private_key_here",
  "your_testnet_burner_wallet_private_key",
]);

function getRegistryConfig() {
  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS;
  const privateKey = process.env.ZERO_G_STORAGE_PRIVATE_KEY;

  const isValidPrivateKey =
    typeof privateKey === "string" &&
    privateKey.trim().length > 0 &&
    !PLACEHOLDER_PRIVATE_KEYS.has(privateKey.trim());

  const isValidContractAddress =
    typeof contractAddress === "string" &&
    contractAddress.trim().length > 0 &&
    contractAddress.startsWith("0x");

  const isConfigured = isValidPrivateKey && isValidContractAddress;

  return {
    contractAddress,
    privateKey,
    isConfigured,
  };
}

/**
 * Returns `true` when both the contract address and a valid private key are
 * configured, meaning on-chain write operations can proceed.
 */
export function isRegistryConfigured(): boolean {
  return getRegistryConfig().isConfigured;
}

// ---------------------------------------------------------------------------
// recordAnalysisOnChain
// ---------------------------------------------------------------------------

type RecordAnalysisInput = {
  rootHash: string;
  storageUri: string;
  score: number;
  recommendation: string;
};

type RecordAnalysisResult = {
  analysisId: number;
  txHash: string;
  blockNumber: number;
} | null;

/**
 * Records a completed analysis on the 0G chain AnalysisRegistry contract.
 *
 * This is an optional enhancement — if the contract is not configured or the
 * transaction fails, it logs a warning and returns `null` instead of throwing.
 */
export async function recordAnalysisOnChain(
  input: RecordAnalysisInput
): Promise<RecordAnalysisResult> {
  const config = getRegistryConfig();
  const networkConfig = getNetworkConfig();

  if (!config.isConfigured) {
    console.warn(
      `[0G Chain] Analysis registry NOT configured — skipping on-chain registration.`
    );
    console.warn(
      `[0G Chain]   contractAddress: ${config.contractAddress ?? "NOT SET"}`
    );
    console.warn(
      `[0G Chain]   privateKey: ${config.privateKey ? "SET" : "NOT SET or PLACEHOLDER"}`
    );
    console.warn(
      `[0G Chain] Fix: Set ZERO_G_STORAGE_PRIVATE_KEY to a wallet with 0G tokens, and ZERO_G_NETWORK=mainnet`
    );
    return null;
  }

  try {
    const { ethers } = await import("ethers");

    const provider = new ethers.JsonRpcProvider(networkConfig.evmRpc);
    const signer = new ethers.Wallet(config.privateKey as string, provider);

    const contract = new ethers.Contract(
      config.contractAddress as string,
      ANALYSIS_REGISTRY_ABI,
      signer
    );

    // Convert the rootHash hex string to the bytes32 format the contract expects
    const rootHashBytes32 = ethers.getBytes(input.rootHash);

    const tx = await contract.recordAnalysis(
      rootHashBytes32,
      input.storageUri,
      input.score,
      input.recommendation
    );

    const receipt = await tx.wait();

    // Parse the AnalysisRecorded event from the logs to extract the analysisId
    let analysisId = 0;

    for (const log of receipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsedLog && parsedLog.name === "AnalysisRecorded") {
          analysisId = Number(parsedLog.args.analysisId);
          break;
        }
      } catch {
        // Not a matching event — skip this log
      }
    }

    if (analysisId === 0) {
      console.warn(
        "[0G Chain] Transaction succeeded but could not parse analysisId from event logs."
      );
    }

    return {
      analysisId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[0G Chain] recordAnalysis FAILED: ${message}`);
    console.error(`[0G Chain] This usually means: wrong network RPC, insufficient gas, or incorrect contract address.`);
    console.error(`[0G Chain] Current RPC: ${networkConfig.evmRpc}`);
    console.error(`[0G Chain] Current network: ${networkConfig.network}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getLatestAnalysisFromChain
// ---------------------------------------------------------------------------

type LatestAnalysisRecord = {
  submitter: string;
  rootHash: string;
  storageUri: string;
  score: number;
  recommendation: string;
  timestamp: number;
} | null;

/**
 * Reads the latest analysis record from the on-chain registry.
 *
 * This is a read-only call — it does not require a private key. If the
 * contract is not deployed or the call fails, it returns `null`.
 */
export async function getLatestAnalysisFromChain(): Promise<LatestAnalysisRecord> {
  const config = getRegistryConfig();
  const networkConfig = getNetworkConfig();

  if (!config.contractAddress || !config.contractAddress.startsWith("0x")) {
    console.warn(
      "[0G Chain] Contract address not configured. Skipping latest analysis read."
    );
    return null;
  }

  try {
    const { ethers } = await import("ethers");

    const provider = new ethers.JsonRpcProvider(networkConfig.evmRpc);

    const contract = new ethers.Contract(
      config.contractAddress,
      ANALYSIS_REGISTRY_ABI,
      provider
    );

    const [submitter, rootHash, storageUri, score, recommendation, timestamp] =
      await contract.getLatestAnalysis();

    return {
      submitter,
      rootHash,
      storageUri,
      score: Number(score),
      recommendation,
      timestamp: Number(timestamp),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[0G Chain] getLatestAnalysis failed: ${message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// buildOnChainReceipt
// ---------------------------------------------------------------------------

/**
 * Builds an `OnChainReceipt` from a successful on-chain registration result,
 * or returns a "not configured" receipt when the registry is unavailable.
 */
export function buildOnChainReceipt(
  result: RecordAnalysisResult,
  contractAddress: string | undefined
): OnChainReceipt {
  if (!result || !contractAddress) {
    return {
      analysisId: 0,
      txHash: "",
      blockNumber: 0,
      contractAddress: "",
      explorerTxUrl: "",
      provider: "NOT_CONFIGURED",
    };
  }

  return {
    analysisId: result.analysisId,
    txHash: result.txHash,
    blockNumber: result.blockNumber,
    contractAddress,
    explorerTxUrl: getExplorerTxUrl(result.txHash),
    provider: "0G_CHAIN",
  };
}
