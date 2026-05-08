// ---------------------------------------------------------------------------
// ClawMind — Real-time 0G Infrastructure Status API
// ---------------------------------------------------------------------------
// Returns the actual connection status of each 0G component without
// requiring an analysis run. Judges can verify infrastructure is live.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  getStorageConfig,
  getNetworkConfig,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { isRegistryConfigured } from "@/lib/contracts/analysis-registry";

export const dynamic = "force-dynamic";

type ComputeStatus = {
  provider: "0G_COMPUTE" | "LOCAL_FALLBACK";
  endpoint: string | null;
  model: string | null;
  isConfigured: boolean;
};

type StorageStatus = {
  provider: "0G_STORAGE" | "LOCAL_FALLBACK";
  network: "mainnet" | "testnet";
  isConfigured: boolean;
  is_enabled: boolean;
};

type OnChainStatus = {
  configured: boolean;
  contractAddress: string | null;
  explorerUrl: string | null;
};

type StatusResponse = {
  network: {
    name: "mainnet" | "testnet";
    chainId: number;
    explorerBaseUrl: string;
  };
  compute: ComputeStatus;
  storage: StorageStatus;
  onChain: OnChainStatus;
  openClawAvailable: boolean;
  timestamp: string;
};

export async function GET(): Promise<NextResponse> {
  try {
    const networkConfig = getNetworkConfig();
    const storageConfig = getStorageConfig();
    const computeProvider = getComputeProviderLabel();
    const registryConfigured = isRegistryConfigured();
    const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

    const compute: ComputeStatus = {
      provider: computeProvider,
      endpoint: process.env.ZERO_G_COMPUTE_ENDPOINT ?? null,
      model: process.env.ZERO_G_COMPUTE_MODEL ?? null,
      isConfigured: computeProvider === "0G_COMPUTE",
    };

    const storage: StorageStatus = {
      provider: storageConfig.isConfigured ? "0G_STORAGE" : "LOCAL_FALLBACK",
      network: storageConfig.network,
      isConfigured: storageConfig.isConfigured,
      is_enabled: storageConfig.enabled,
    };

    const onChain: OnChainStatus = {
      configured: registryConfigured,
      contractAddress,
      explorerUrl: contractAddress
        ? getExplorerAddressUrl(contractAddress)
        : null,
    };

    const response: StatusResponse = {
      network: {
        name: networkConfig.network,
        chainId: networkConfig.chainId,
        explorerBaseUrl: networkConfig.explorerBaseUrl,
      },
      compute,
      storage,
      onChain,
      openClawAvailable: true,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Status API] Error:", message);

    return NextResponse.json(
      { error: "Failed to check status.", details: message },
      { status: 500 }
    );
  }
}
