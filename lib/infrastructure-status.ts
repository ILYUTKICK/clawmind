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
import { loadAndValidateManifest } from "@/lib/openclaw/manifest-parser";
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
    /** Number of distinct models in the multi-model ensemble */
    modelCount: number;
    /** Whether the multi-model ensemble is active */
    multiModelEnsemble: boolean;
    /** Strategy description */
    strategy: string;
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
  openClaw: {
    available: boolean;
    manifestValid: boolean;
    manifestErrors: string[];
    pipelineSteps: number;
  };
  semanticMemory: {
    embeddingModel: string;
    embeddingDimensions: number;
    available: boolean;
  };
};

// ---------------------------------------------------------------------------
// getInfrastructureStatus
// ---------------------------------------------------------------------------

/**
 * Returns the unified infrastructure status object.
 *
 * This is the single source of truth for compute, storage, on-chain,
 * OpenClaw, and semantic memory status.
 */
export async function getInfrastructureStatus(): Promise<InfrastructureStatus> {
  // --- Synchronous computations ---
  const networkConfig = getNetworkConfig();
  const storageConfig = getStorageConfig();
  const computeProvider = getComputeProviderLabel();
  const registryConfigured = isRegistryConfigured();
  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

  // --- Async: load and validate manifest ---
  let openClawAvailable = false;
  let manifestValid = false;
  let manifestErrors: string[] = [];
  let pipelineSteps = 0;
  let modelCount = 1;
  let multiModelEnsemble = false;
  let strategy = "single_model";

  try {
    const manifestPath = path.join(process.cwd(), "openclaw.yaml");
    await fs.access(manifestPath);
    openClawAvailable = true;

    // Parse and validate the manifest
    const { config, validation } = await loadAndValidateManifest();
    manifestValid = validation.valid;
    manifestErrors = validation.errors;
    pipelineSteps = config.pipeline.length;

    // Extract multi-model info
    modelCount = config.models.length;
    multiModelEnsemble = modelCount > 1;
    strategy = config.strategy;
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
      modelCount,
      multiModelEnsemble,
      strategy,
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
    openClaw: {
      available: openClawAvailable,
      manifestValid,
      manifestErrors,
      pipelineSteps,
    },
    semanticMemory: {
      embeddingModel: "all-MiniLM-L6-v2",
      embeddingDimensions: 384,
      available: true, // Always available — lazy-loads on first use
    },
  };
}
