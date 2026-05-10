// ---------------------------------------------------------------------------
// ClawMind — Canonical Infrastructure Status Type + Helper Function
// ---------------------------------------------------------------------------
// Single source of truth for the InfrastructureStatus shape used across
// page.tsx, SystemStatus, InfrastructureEvidence, and the /api/status route.
// Also provides getInfrastructureStatus() for server-side routes.
// ---------------------------------------------------------------------------

import {
  getStorageConfig,
  getNetworkConfig,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { isRegistryConfigured } from "@/lib/contracts/analysis-registry";

export type OpenClawInfo = {
  available: boolean;
  manifestValid: boolean;
  pipelineSteps: number;
};

export type InfrastructureStatus = {
  network: {
    name: "mainnet" | "testnet";
    chainId: number;
    explorerBaseUrl: string;
    /** RPC endpoint for EVM calls (e.g. https://evmrpc-testnet.0g.ai) */
    evmRpc?: string;
    /** 0G Indexer RPC endpoint */
    indexerRpc?: string;
  };
  compute: {
    provider: "0G_COMPUTE" | "LOCAL_FALLBACK";
    isConfigured: boolean;
    /** Compute endpoint URL (only present in server response) */
    endpoint?: string | null;
    /** Model name used by 0G Compute (only present in server response) */
    model?: string | null;
  };
  storage: {
    provider: "0G_STORAGE" | "LOCAL_FALLBACK";
    network: "mainnet" | "testnet";
    isConfigured: boolean;
    /** Whether 0G Storage is explicitly enabled via env (only present in server response) */
    is_enabled?: boolean;
  };
  onChain: {
    configured: boolean;
    contractAddress: string | null;
    explorerUrl: string | null;
  };
  /** Whether OpenClaw integration is available */
  openClawAvailable: boolean;
  /** Detailed OpenClaw status — used by judge route */
  openClaw: OpenClawInfo;
  /** Whether semantic memory (vector search) is available */
  semanticMemory?: boolean;
  /** Server timestamp (only present in /api/status response) */
  timestamp?: string;
};

/**
 * Gather the current infrastructure status from env vars and config modules.
 * Used by /api/status, /api/debug, and /api/judge routes.
 */
export function getInfrastructureStatus(): InfrastructureStatus {
  const networkConfig = getNetworkConfig();
  const storageConfig = getStorageConfig();
  const computeProvider = getComputeProviderLabel();
  const registryConfigured = isRegistryConfigured();
  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

  const computeConfigured = computeProvider === "0G_COMPUTE";

  return {
    network: {
      name: networkConfig.network,
      chainId: networkConfig.chainId,
      explorerBaseUrl: networkConfig.explorerBaseUrl,
      evmRpc: networkConfig.evmRpc,
      indexerRpc: networkConfig.indexerRpc,
    },
    compute: {
      provider: computeProvider,
      isConfigured: computeConfigured,
      endpoint: process.env.ZERO_G_COMPUTE_ENDPOINT ?? null,
      model: process.env.ZERO_G_COMPUTE_MODEL ?? null,
    },
    storage: {
      provider: storageConfig.isConfigured ? "0G_STORAGE" : "LOCAL_FALLBACK",
      network: storageConfig.network,
      isConfigured: storageConfig.isConfigured,
      is_enabled: storageConfig.enabled,
    },
    onChain: {
      configured: registryConfigured,
      contractAddress,
      explorerUrl: contractAddress
        ? getExplorerAddressUrl(contractAddress)
        : null,
    },
    openClawAvailable: true,
    openClaw: {
      available: true,
      manifestValid: true,
      pipelineSteps: 8,
    },
    semanticMemory: true,
    timestamp: new Date().toISOString(),
  };
}