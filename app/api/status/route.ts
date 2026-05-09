// ---------------------------------------------------------------------------
// ClawMind — Real-time 0G Infrastructure Status API
// ---------------------------------------------------------------------------
// Returns the actual connection status of each 0G component without
// requiring an analysis run. Judges can verify infrastructure is live.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getInfrastructureStatus } from "@/lib/infrastructure-status";

export const dynamic = "force-dynamic";

type StatusResponse = {
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
    /** @deprecated Use isEnabled instead — kept for backward compatibility */
    is_enabled: boolean;
  };
  onChain: {
    configured: boolean;
    contractAddress: string | null;
    explorerUrl: string | null;
  };
  openClaw: {
    available: boolean;
    manifestValid: boolean;
    pipelineSteps: number;
  };
  semanticMemory: {
    embeddingModel: string;
    embeddingDimensions: number;
    available: boolean;
  };
  timestamp: string;
};

export async function GET(): Promise<NextResponse> {
  try {
    const infra = await getInfrastructureStatus();

    const response: StatusResponse = {
      network: {
        name: infra.network.name,
        chainId: infra.network.chainId,
        explorerBaseUrl: infra.network.explorerBaseUrl,
        evmRpc: infra.network.evmRpc,
        indexerRpc: infra.network.indexerRpc,
      },
      compute: {
        provider: infra.compute.provider,
        isConfigured: infra.compute.isConfigured,
        endpoint: infra.compute.endpoint,
        model: infra.compute.model,
      },
      storage: {
        provider: infra.storage.provider,
        network: infra.storage.network,
        isConfigured: infra.storage.isConfigured,
        isEnabled: infra.storage.isEnabled,
        // Backward-compatible snake_case alias for existing consumers
        is_enabled: infra.storage.isEnabled,
      },
      onChain: {
        configured: infra.onChain.configured,
        contractAddress: infra.onChain.contractAddress,
        explorerUrl: infra.onChain.explorerUrl,
      },
      openClaw: {
        available: infra.openClaw.available,
        manifestValid: infra.openClaw.manifestValid,
        pipelineSteps: infra.openClaw.pipelineSteps,
      },
      semanticMemory: {
        embeddingModel: infra.semanticMemory.embeddingModel,
        embeddingDimensions: infra.semanticMemory.embeddingDimensions,
        available: infra.semanticMemory.available,
      },
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
