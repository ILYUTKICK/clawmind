// ---------------------------------------------------------------------------
// ClawMind — On-chain Analysis Registry integration for 0G chain
// ---------------------------------------------------------------------------

import { getNetworkConfig, getExplorerTxUrl } from "@/lib/storage/zero-g-config";
import type { OnChainReceipt } from "@/lib/types";
import type { Contract, ContractTransactionReceipt, Provider, TypedDataField } from "ethers";

// ---------------------------------------------------------------------------
// ABI — only the functions and events we need
// ---------------------------------------------------------------------------

export const ANALYSIS_REGISTRY_ABI = [
  "function ANALYSIS_TYPEHASH() external view returns (bytes32)",
  "function recordAnalysis(bytes32 taskHash, bytes32 rootHash, string calldata storageUri, uint8 score, string calldata recommendation, uint256 timestamp, bytes calldata signature) external returns (uint256)",
  "function recordAnalysis(bytes32 rootHash, string calldata storageUri, uint8 score, string calldata recommendation) external returns (uint256)",
  "function getAnalysis(uint256 analysisId) external view returns (address submitter, bytes32 rootHash, string memory storageUri, uint8 score, string memory recommendation, uint256 timestamp)",
  "function getAnalysisAuth(uint256 analysisId) external view returns (bytes32 taskHash, bool submitterAuthorized)",
  "function isRootHashRegistered(bytes32 rootHash) external view returns (bool)",
  "function getLatestAnalysis() external view returns (address submitter, bytes32 rootHash, string memory storageUri, uint8 score, string memory recommendation, uint256 timestamp)",
  "function getLatestAnalysisAuth() external view returns (bytes32 taskHash, bool submitterAuthorized)",
  "function domainSeparator() external view returns (bytes32)",
  "function authorizedOperators(address operator) external view returns (bool)",
  "function analysisCount() external view returns (uint256)",
  "event AnalysisRecorded(uint256 indexed analysisId, address indexed submitter, bytes32 indexed taskHash, bytes32 rootHash, uint8 score, string recommendation, string storageUri, uint256 timestamp, bytes signature)",
  "event AnalysisRecorded(uint256 indexed analysisId, address indexed submitter, bytes32 indexed taskHash, bytes32 rootHash, uint8 score, string recommendation, string storageUri, uint256 timestamp)",
  "event AnalysisRecorded(uint256 indexed analysisId, address indexed submitter, bytes32 rootHash, uint8 score, string recommendation, string storageUri, uint256 timestamp)",
] as const;

const ANALYSIS_REGISTRY_V3_AUTH_ABI = [
  "function getLatestAnalysisAuth() external view returns (bytes32 taskHash, bytes memory signature, bool submitterAuthorized)",
] as const;

const ANALYSIS_REGISTRY_V4_AUTH_ABI = [
  "function getLatestAnalysisAuth() external view returns (bytes32 taskHash, bool submitterAuthorized)",
] as const;

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/** Placeholder strings that indicate a private key has not been set. */
const PLACEHOLDER_PRIVATE_KEYS = new Set([
  "your_wallet_private_key_here",
  "your_testnet_wallet_private_key_here",
  "your_testnet_burner_wallet_private_key",
  "your_mainnet_wallet_private_key",
]);

type RegistryEip712Version = "3" | "4";

const EIP712_DOMAIN_NAME = "ClawMindAnalysisRegistry";
const EIP712_DOMAIN_VERSION_V3 = "3";
const EIP712_DOMAIN_VERSION_V4 = "4";
const ANALYSIS_EIP712_STRUCT_V3 =
  "Analysis(bytes32 taskHash,bytes32 rootHash,uint8 score,uint256 timestamp)";
const ANALYSIS_EIP712_STRUCT_V4 =
  "Analysis(bytes32 taskHash,bytes32 rootHash,uint8 score,string storageUri,string recommendation,uint256 timestamp)";

const ANALYSIS_EIP712_TYPES_V3: Record<string, TypedDataField[]> = {
  Analysis: [
    { name: "taskHash", type: "bytes32" },
    { name: "rootHash", type: "bytes32" },
    { name: "score", type: "uint8" },
    { name: "timestamp", type: "uint256" },
  ],
};

const ANALYSIS_EIP712_TYPES_V4: Record<string, TypedDataField[]> = {
  Analysis: [
    { name: "taskHash", type: "bytes32" },
    { name: "rootHash", type: "bytes32" },
    { name: "score", type: "uint8" },
    { name: "storageUri", type: "string" },
    { name: "recommendation", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

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

function getRegistryDeployBlock(): number {
  const rawBlock = process.env.ZERO_G_ANALYSIS_REGISTRY_DEPLOY_BLOCK;
  const parsedBlock = rawBlock ? Number(rawBlock) : 0;

  return Number.isInteger(parsedBlock) && parsedBlock >= 0 ? parsedBlock : 0;
}

/**
 * Returns `true` when both the contract address and a valid private key are
 * configured, meaning on-chain write operations can proceed.
 */
export function isRegistryConfigured(): boolean {
  return getRegistryConfig().isConfigured;
}

export type RegistryAuthStatus = {
  contractSupportsOperatorAuth: boolean;
  registryVersion: RegistryEip712Version | null;
  domainSeparator: string | null;
  operatorAddress: string | null;
  operatorAuthorized: boolean | null;
  mode: "SIGNED_OPERATOR_READY" | "SIGNED_OPERATOR_NEEDS_AUTH" | "SIGNED_REGISTRY_NO_OPERATOR_KEY" | "LEGACY_OR_NOT_DEPLOYED";
};

export async function getRegistryAuthStatus(): Promise<RegistryAuthStatus> {
  const config = getRegistryConfig();
  const networkConfig = getNetworkConfig();

  const fallback: RegistryAuthStatus = {
    contractSupportsOperatorAuth: false,
    registryVersion: null,
    domainSeparator: null,
    operatorAddress: null,
    operatorAuthorized: null,
    mode: "LEGACY_OR_NOT_DEPLOYED",
  };

  if (!config.contractAddress || !config.contractAddress.startsWith("0x")) {
    return fallback;
  }

  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(networkConfig.evmRpc);
    const contract = new ethers.Contract(
      config.contractAddress,
      ANALYSIS_REGISTRY_ABI,
      provider
    );
    const domainSeparator = await contract.domainSeparator();
    const registryVersion = await getRegistryEip712Version(ethers, contract);

    if (!config.privateKey || PLACEHOLDER_PRIVATE_KEYS.has(config.privateKey.trim())) {
      return {
        contractSupportsOperatorAuth: true,
        registryVersion,
        domainSeparator,
        operatorAddress: null,
        operatorAuthorized: null,
        mode: "SIGNED_REGISTRY_NO_OPERATOR_KEY",
      };
    }

    const operatorAddress = new ethers.Wallet(config.privateKey).address;
    const operatorAuthorized = Boolean(await contract.authorizedOperators(operatorAddress));

    return {
      contractSupportsOperatorAuth: true,
      registryVersion,
      domainSeparator,
      operatorAddress,
      operatorAuthorized,
      mode: operatorAuthorized ? "SIGNED_OPERATOR_READY" : "SIGNED_OPERATOR_NEEDS_AUTH",
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// recordAnalysisOnChain
// ---------------------------------------------------------------------------

type RecordAnalysisInput = {
  task: string;
  rootHash: string;
  storageUri: string;
  score: number;
  recommendation: string;
};

type RecordAnalysisResult = {
  analysisId: number;
  txHash: string;
  blockNumber: number;
  taskHash?: string;
  signature?: string;
  signedBy?: string;
  signatureVerified?: boolean;
  registryMode: "SIGNED_OPERATOR" | "LEGACY_UNAUTHENTICATED";
} | null;

function shouldAllowLegacyRegistryWrites(): boolean {
  return process.env.ZERO_G_ALLOW_LEGACY_REGISTRY_WRITES === "true";
}

function normalizeBytes32(ethers: typeof import("ethers").ethers, value: string): string {
  const trimmed = value.trim();

  if (ethers.isHexString(trimmed, 32)) {
    return trimmed;
  }

  return ethers.keccak256(ethers.toUtf8Bytes(trimmed));
}

function getTaskHash(ethers: typeof import("ethers").ethers, task: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(task.trim()));
}

function getDomainVersion(registryVersion: RegistryEip712Version): string {
  return registryVersion === "4" ? EIP712_DOMAIN_VERSION_V4 : EIP712_DOMAIN_VERSION_V3;
}

function getAnalysisEip712Types(
  registryVersion: RegistryEip712Version
): Record<string, TypedDataField[]> {
  return registryVersion === "4" ? ANALYSIS_EIP712_TYPES_V4 : ANALYSIS_EIP712_TYPES_V3;
}

type AnalysisTypedDataInput = {
  taskHash: string;
  rootHash: string;
  score: number;
  storageUri: string;
  recommendation: string;
  timestamp: number;
};

function getAnalysisTypedDataValue(
  registryVersion: RegistryEip712Version,
  input: AnalysisTypedDataInput
): Record<string, string | number> {
  if (registryVersion === "4") {
    return {
      taskHash: input.taskHash,
      rootHash: input.rootHash,
      score: input.score,
      storageUri: input.storageUri,
      recommendation: input.recommendation,
      timestamp: input.timestamp,
    };
  }

  return {
    taskHash: input.taskHash,
    rootHash: input.rootHash,
    score: input.score,
    timestamp: input.timestamp,
  };
}

async function getRegistryEip712Version(
  ethers: typeof import("ethers").ethers,
  contract: Contract
): Promise<RegistryEip712Version | null> {
  try {
    const typehash = String(await contract.ANALYSIS_TYPEHASH()).toLowerCase();
    const v3Typehash = ethers
      .keccak256(ethers.toUtf8Bytes(ANALYSIS_EIP712_STRUCT_V3))
      .toLowerCase();
    const v4Typehash = ethers
      .keccak256(ethers.toUtf8Bytes(ANALYSIS_EIP712_STRUCT_V4))
      .toLowerCase();

    if (typehash === v4Typehash) {
      return "4";
    }

    if (typehash === v3Typehash) {
      return "3";
    }

    return null;
  } catch {
    return null;
  }
}

async function registrySupportsOperatorAuth(
  contract: Contract,
  signerAddress: string
): Promise<boolean> {
  try {
    await contract.domainSeparator();
    await contract.authorizedOperators(signerAddress);
    return true;
  } catch {
    return false;
  }
}

async function parseAnalysisId(
  contract: Contract,
  receipt: ContractTransactionReceipt | null
): Promise<number> {
  if (!receipt) {
    return 0;
  }

  for (const log of receipt.logs) {
    try {
      const parsedLog = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsedLog && parsedLog.name === "AnalysisRecorded") {
        return Number(parsedLog.args.analysisId);
      }
    } catch {
      // Not a matching event — skip this log
    }
  }

  return 0;
}

async function getAnalysisEventSignature(
  ethers: typeof import("ethers").ethers,
  provider: Provider,
  contract: Contract,
  contractAddress: string,
  analysisId: number
): Promise<string | undefined> {
  try {
    const topic0 = ethers.id(
      "AnalysisRecorded(uint256,address,bytes32,bytes32,uint8,string,string,uint256,bytes)"
    );
    const topic1 = ethers.zeroPadValue(ethers.toBeHex(analysisId), 32);
    const logs = await provider.getLogs({
      address: contractAddress,
      topics: [topic0, topic1],
      fromBlock: getRegistryDeployBlock(),
      toBlock: "latest",
    });

    for (let i = logs.length - 1; i >= 0; i--) {
      const parsedLog = contract.interface.parseLog({
        topics: logs[i].topics as string[],
        data: logs[i].data,
      });

      const signature = parsedLog?.args?.signature;
      if (typeof signature === "string" && signature.length > 2) {
        return signature;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function verifyAnalysisSignature(
  ethers: typeof import("ethers").ethers,
  registryVersion: RegistryEip712Version,
  chainId: number,
  contractAddress: string,
  submitter: string,
  signature: string,
  input: AnalysisTypedDataInput
): boolean {
  try {
    const recovered = ethers.verifyTypedData(
      {
        name: EIP712_DOMAIN_NAME,
        version: getDomainVersion(registryVersion),
        chainId,
        verifyingContract: contractAddress,
      },
      getAnalysisEip712Types(registryVersion),
      getAnalysisTypedDataValue(registryVersion, input),
      signature
    );

    return recovered.toLowerCase() === submitter.toLowerCase();
  } catch {
    return false;
  }
}

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
    const signerAddress = await signer.getAddress();

    const contract = new ethers.Contract(
      config.contractAddress as string,
      ANALYSIS_REGISTRY_ABI,
      signer
    );

    const rootHashBytes32 = normalizeBytes32(ethers, input.rootHash);
    const taskHash = getTaskHash(ethers, input.task);
    const signedAt = Math.floor(Date.now() / 1000);

    const supportsOperatorAuth = await registrySupportsOperatorAuth(
      contract,
      signerAddress
    );

    if (!supportsOperatorAuth) {
      if (!shouldAllowLegacyRegistryWrites()) {
        console.warn(
          "[0G Chain] Contract does not expose EIP-712 operator auth. Refusing unauthenticated legacy write."
        );
        console.warn(
          "[0G Chain] Deploy the signed AnalysisRegistry or set ZERO_G_ALLOW_LEGACY_REGISTRY_WRITES=true for temporary backward compatibility."
        );
        return null;
      }

      console.warn(
        "[0G Chain] LEGACY registry write enabled. This does not verify an authorized operator signature."
      );

      const legacyTx = await contract["recordAnalysis(bytes32,string,uint8,string)"](
        rootHashBytes32,
        input.storageUri,
        input.score,
        input.recommendation
      );

      const legacyReceipt = await legacyTx.wait();
      const legacyAnalysisId = await parseAnalysisId(contract, legacyReceipt);

      if (legacyAnalysisId === 0) {
        console.warn(
          "[0G Chain] Transaction succeeded but could not parse analysisId from event logs."
        );
      }

      return {
        analysisId: legacyAnalysisId,
        txHash: legacyReceipt?.hash ?? "",
        blockNumber: legacyReceipt?.blockNumber ?? 0,
        registryMode: "LEGACY_UNAUTHENTICATED",
      };
    }

    const isAuthorizedOperator = await contract.authorizedOperators(signerAddress);

    if (!isAuthorizedOperator) {
      console.warn(
        `[0G Chain] Signer ${signerAddress} is not an authorized operator for this registry.`
      );
      return null;
    }

    const registryVersion = await getRegistryEip712Version(ethers, contract);

    if (!registryVersion) {
      console.warn(
        "[0G Chain] Contract exposes operator auth but its Analysis EIP-712 typehash is unsupported."
      );
      return null;
    }

    const signature = await signer.signTypedData(
      {
        name: EIP712_DOMAIN_NAME,
        version: getDomainVersion(registryVersion),
        chainId: networkConfig.chainId,
        verifyingContract: config.contractAddress as string,
      },
      getAnalysisEip712Types(registryVersion),
      getAnalysisTypedDataValue(registryVersion, {
        taskHash,
        rootHash: rootHashBytes32,
        score: input.score,
        storageUri: input.storageUri,
        recommendation: input.recommendation,
        timestamp: signedAt,
      })
    );

    const tx = await contract["recordAnalysis(bytes32,bytes32,string,uint8,string,uint256,bytes)"](
      taskHash,
      rootHashBytes32,
      input.storageUri,
      input.score,
      input.recommendation,
      signedAt,
      signature
    );

    const receipt = await tx.wait();
    const analysisId = await parseAnalysisId(contract, receipt);

    if (analysisId === 0) {
      console.warn(
        "[0G Chain] Transaction succeeded but could not parse analysisId from event logs."
      );
    }

    return {
      analysisId,
      txHash: receipt?.hash ?? "",
      blockNumber: receipt?.blockNumber ?? 0,
      taskHash,
      signature,
      signedBy: signerAddress,
      signatureVerified: true,
      registryMode: "SIGNED_OPERATOR",
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
  analysisId: number;
  submitter: string;
  rootHash: string;
  storageUri: string;
  score: number;
  recommendation: string;
  timestamp: number;
  taskHash?: string;
  signature?: string;
  signatureVerified?: boolean;
  registryMode: "SIGNED_OPERATOR" | "LEGACY_UNAUTHENTICATED";
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

    const analysisCount = await contract.analysisCount();
    const [submitter, rootHash, storageUri, score, recommendation, timestamp] =
      await contract.getLatestAnalysis();
    const registryVersion = await getRegistryEip712Version(ethers, contract);
    const analysisId = Number(analysisCount);
    const numericScore = Number(score);
    const numericTimestamp = Number(timestamp);

    let taskHash: string | undefined;
    let signature: string | undefined;
    let signatureVerified: boolean | undefined;
    let registryMode: "SIGNED_OPERATOR" | "LEGACY_UNAUTHENTICATED" =
      "LEGACY_UNAUTHENTICATED";

    try {
      if (registryVersion === "4") {
        const authContract = new ethers.Contract(
          config.contractAddress,
          ANALYSIS_REGISTRY_V4_AUTH_ABI,
          provider
        );
        const [latestTaskHash, submitterAuthorized] =
          await authContract.getLatestAnalysisAuth();

        taskHash = latestTaskHash;
        signature = await getAnalysisEventSignature(
          ethers,
          provider,
          contract,
          config.contractAddress,
          analysisId
        );
        signatureVerified = signature
          ? Boolean(submitterAuthorized) &&
            verifyAnalysisSignature(
              ethers,
              registryVersion,
              networkConfig.chainId,
              config.contractAddress,
              submitter,
              signature,
              {
                taskHash: latestTaskHash,
                rootHash,
                score: numericScore,
                storageUri,
                recommendation,
                timestamp: numericTimestamp,
              }
            )
          : Boolean(submitterAuthorized);
        registryMode = "SIGNED_OPERATOR";
      } else if (registryVersion === "3") {
        const authContract = new ethers.Contract(
          config.contractAddress,
          ANALYSIS_REGISTRY_V3_AUTH_ABI,
          provider
        );
        const [latestTaskHash, latestSignature, submitterAuthorized] =
          await authContract.getLatestAnalysisAuth();

        taskHash = latestTaskHash;
        signature = latestSignature;
        signatureVerified =
          Boolean(submitterAuthorized) &&
          typeof latestSignature === "string" &&
          verifyAnalysisSignature(
            ethers,
            registryVersion,
            networkConfig.chainId,
            config.contractAddress,
            submitter,
            latestSignature,
            {
              taskHash: latestTaskHash,
              rootHash,
              score: numericScore,
              storageUri,
              recommendation,
              timestamp: numericTimestamp,
            }
          );
        registryMode = "SIGNED_OPERATOR";
      }
    } catch {
      // Older registry contract: keep legacy read shape.
    }

    return {
      analysisId,
      submitter,
      rootHash,
      storageUri,
      score: numericScore,
      recommendation,
      timestamp: numericTimestamp,
      taskHash,
      signature,
      signatureVerified,
      registryMode,
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
    taskHash: result.taskHash,
    signature: result.signature,
    signedBy: result.signedBy,
    signatureVerified: result.signatureVerified,
    registryMode: result.registryMode,
  };
}
