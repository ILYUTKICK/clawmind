// ---------------------------------------------------------------------------
// ClawMind — Unified Infrastructure Status — Single Source of Truth
// ---------------------------------------------------------------------------
// All API routes and the frontend should import from this module instead of
// independently computing infrastructure status with slightly different logic.
// ---------------------------------------------------------------------------

import {
  getNetworkConfig,
  getStorageConfig,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { isRegistryConfigured } from "@/lib/contracts/analysis-registry";
import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type InfrastructureStatus = {
  network: {
    name: "mainnet" | "testnet";
    chainId: number;
    explorerBaseUrl: string;
    evmRpc: string;
    indexerRpc: string;
  };
  compute: {
    provider: "0G_COMPUTE" | "LOCAL_FALLBACK";
    isConfigured: boolean;
    endpoint: string | null;
    model: string | null;
  };
  storage: {
    provider: "0G_STORAGE" | "LOCAL_FALLBACK";
    network: "mainnet" | "testnet";
    isConfigured: boolean;
    isEnabled: boolean;
  };
  onChain: {
    configured: boolean;
    contractAddress: string | null;
    explorerUrl: string | null;
  };
  openClawAvailable: boolean;
};

// ---------------------------------------------------------------------------
// getInfrastructureStatus
// ---------------------------------------------------------------------------

/**
 * Returns the unified infrastructure status object.
 *
 * This is the single source of truth for compute, storage, on-chain, and
 * OpenClaw status. All API routes should call this instead of duplicating
 * the logic locally.
 *
 * The function is async only because `openClawAvailable` requires a filesystem
 * check (fs.access). All other computations are synchronous.
 */
export async function getInfrastructureStatus(): Promise<InfrastructureStatus> {
  // --- Synchronous computations ---
  const networkConfig = getNetworkConfig();
  const storageConfig = getStorageConfig();
  const computeProvider = getComputeProviderLabel();
  const registryConfigured = isRegistryConfigured();
  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

  // --- Async: check openclaw.yaml existence ---
  let openClawAvailable = false;
  try {
    const manifestPath = path.join(process.cwd(), "openclaw.yaml");
    await fs.access(manifestPath);
    openClawAvailable = true;
  } catch {
    openClawAvailable = false;
  }

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
      isConfigured: computeProvider === "0G_COMPUTE",
      endpoint: process.env.ZERO_G_COMPUTE_ENDPOINT ?? null,
      model: process.env.ZERO_G_COMPUTE_MODEL ?? null,
    },
    storage: {
      provider: storageConfig.isConfigured ? "0G_STORAGE" : "LOCAL_FALLBACK",
      network: storageConfig.network,
      isConfigured: storageConfig.isConfigured,
      isEnabled: storageConfig.enabled,
    },
    onChain: {
      configured: registryConfigured,
      contractAddress,
      explorerUrl: contractAddress
        ? getExplorerAddressUrl(contractAddress)
        : null,
    },
    openClawAvailable,
  };
}
