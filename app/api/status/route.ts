// ---------------------------------------------------------------------------
// ClawMind — Status API with Async Task Polling
// ---------------------------------------------------------------------------
// Returns infrastructure status OR task progress when ?taskId= is provided.
// The client polls this endpoint while the pipeline runs in the background.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  getStorageConfig,
  getNetworkConfig,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { isRegistryConfigured } from "@/lib/contracts/analysis-registry";
import { getTask, getLatestTask } from "@/lib/orchestrator/task-store";

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

type InfraStatusResponse = {
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if this is a task polling request
    const taskId = request.nextUrl.searchParams.get("taskId");

    if (taskId) {
      return handleTaskPoll(taskId);
    }

    // Otherwise return infrastructure status
    return handleInfraStatus();
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

function handleTaskPoll(taskId: string): NextResponse {
  const task = getTask(taskId);

  if (!task) {
    return NextResponse.json(
      { error: "Task not found. It may have expired." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      taskId: task.taskId,
      task: task.task,
      status: task.status,
      currentStep: task.currentStep,
      steps: task.steps,
      result: task.result,
      error: task.error,
      updatedAt: task.updatedAt,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function handleInfraStatus(): NextResponse {
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

  const response: InfraStatusResponse = {
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
}