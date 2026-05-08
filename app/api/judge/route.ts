// ---------------------------------------------------------------------------
// ClawMind — Judge API Endpoint
// ---------------------------------------------------------------------------
// Returns all the evidence a hackathon judge needs on a single read-only page,
// without requiring any wallet connection or running an analysis.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  getStorageConfig,
  getNetworkConfig,
  getExplorerTxUrl,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import {
  isRegistryConfigured,
  getLatestAnalysisFromChain,
  ANALYSIS_REGISTRY_ABI,
} from "@/lib/contracts/analysis-registry";
import { getAllMemories } from "@/lib/memory/memory-manager";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JudgeNetworkInfo = {
  name: "mainnet" | "testnet";
  chainId: number;
  explorerBaseUrl: string;
};

type JudgeComputeInfo = {
  provider: "0G_COMPUTE" | "LOCAL_FALLBACK";
  status: "active" | "fallback";
};

type JudgeStorageInfo = {
  configured: boolean;
  provider: "0G_STORAGE" | "LOCAL_FALLBACK";
  network: string;
};

type JudgeOnChainInfo = {
  configured: boolean;
  contractAddress: string | null;
  explorerUrl: string | null;
  latestAnalysis: Record<string, unknown> | null;
};

type JudgeOpenClawInfo = {
  available: boolean;
  manifestUrl: string;
};

type JudgeIntegrationInfo = {
  compute: JudgeComputeInfo;
  storage: JudgeStorageInfo;
  onChain: JudgeOnChainInfo;
  openClaw: JudgeOpenClawInfo;
};

type JudgeLatestOnChainAnalysis = {
  analysisId: number;
  rootHash: string;
  storageUri: string;
  score: number;
  recommendation: string;
  timestamp: number;
  submitter: string;
  explorerTxUrl: string;
};

type JudgeMemoryStats = {
  totalRecords: number;
  zeroGBackedCount: number;
  sampleMemoryIds: string[];
};

type JudgeData = {
  // Project info
  projectName: string;
  track: string;
  description: string;

  // Network info
  network: JudgeNetworkInfo;

  // 0G Integration Evidence
  integration: JudgeIntegrationInfo;

  // Latest on-chain analysis (if available)
  latestOnChainAnalysis: JudgeLatestOnChainAnalysis | null;

  // Memory stats
  memory: JudgeMemoryStats;

  // Timestamps
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Helper: read openclaw.yaml for project metadata
// ---------------------------------------------------------------------------

async function getProjectInfo(): Promise<{
  projectName: string;
  track: string;
  description: string;
}> {
  try {
    const manifestPath = path.join(process.cwd(), "openclaw.yaml");
    const raw = await fs.readFile(manifestPath, "utf-8");

    const nameMatch = raw.match(/^name:\s*(.+)$/m);
    const trackMatch = raw.match(/^track:\s*["']?(.+?)["']?\s*$/m);
    const descMatch = raw.match(
      /description:\s*>-\s*\n([\s\S]*?)(?=\n\S|\n$|$)/
    );

    return {
      projectName: nameMatch?.[1]?.trim() ?? "ClawMind",
      track: trackMatch?.[1]?.trim() ?? "Unknown",
      description: descMatch?.[1]?.trim() ?? "",
    };
  } catch {
    return {
      projectName: "ClawMind",
      track: "Unknown",
      description: "Project manifest not available.",
    };
  }
}

// ---------------------------------------------------------------------------
// Helper: get analysis count from the on-chain registry
// ---------------------------------------------------------------------------

async function getAnalysisCountFromChain(): Promise<number> {
  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS;

  if (!contractAddress || !contractAddress.startsWith("0x")) {
    return 0;
  }

  try {
    const { ethers } = await import("ethers");
    const networkConfig = getNetworkConfig();
    const provider = new ethers.JsonRpcProvider(networkConfig.evmRpc);
    const contract = new ethers.Contract(
      contractAddress,
      ANALYSIS_REGISTRY_ABI,
      provider
    );
    const count = await contract.analysisCount();
    return Number(count);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    // --- Project info from openclaw.yaml ---
    const projectInfo = await getProjectInfo();

    // --- Network configuration ---
    const networkConfig = getNetworkConfig();
    const storageConfig = getStorageConfig();

    const network: JudgeNetworkInfo = {
      name: networkConfig.network,
      chainId: networkConfig.chainId,
      explorerBaseUrl: networkConfig.explorerBaseUrl,
    };

    // --- Compute integration evidence ---
    const computeProvider = getComputeProviderLabel();

    const compute: JudgeComputeInfo = {
      provider: computeProvider,
      status: computeProvider === "0G_COMPUTE" ? "active" : "fallback",
    };

    // --- Storage integration evidence ---
    const storage: JudgeStorageInfo = {
      configured: storageConfig.isConfigured,
      provider: storageConfig.isConfigured ? "0G_STORAGE" : "LOCAL_FALLBACK",
      network: storageConfig.network,
    };

    // --- On-chain integration evidence ---
    const registryConfigured = isRegistryConfigured();
    const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

    let latestOnChainAnalysis: JudgeLatestOnChainAnalysis | null = null;
    let latestAnalysisRaw: Record<string, unknown> | null = null;

    if (contractAddress && contractAddress.startsWith("0x")) {
      const analysisFromChain = await getLatestAnalysisFromChain();

      if (analysisFromChain) {
        latestAnalysisRaw = analysisFromChain as unknown as Record<
          string,
          unknown
        >;

        // Get the analysis count to derive the latest analysisId
        const analysisCount = await getAnalysisCountFromChain();
        const analysisId = analysisCount > 0 ? analysisCount - 1 : 0;

        // The explorerTxUrl should link to the contract address page so judges
        // can see all registered transactions — individual tx hashes are not
        // available from a read-only getLatestAnalysis call.
        const contractExplorerUrl = contractAddress
          ? getExplorerAddressUrl(contractAddress)
          : null;

        latestOnChainAnalysis = {
          analysisId,
          rootHash: analysisFromChain.rootHash,
          storageUri: analysisFromChain.storageUri,
          score: analysisFromChain.score,
          recommendation: analysisFromChain.recommendation,
          timestamp: analysisFromChain.timestamp,
          submitter: analysisFromChain.submitter,
          explorerTxUrl: contractExplorerUrl ?? "",
        };
      }
    }

    const onChain: JudgeOnChainInfo = {
      configured: registryConfigured,
      contractAddress,
      explorerUrl: contractAddress
        ? getExplorerAddressUrl(contractAddress)
        : null,
      latestAnalysis: latestAnalysisRaw,
    };

    // --- OpenClaw evidence ---
    let openClawAvailable = false;
    try {
      const manifestPath = path.join(process.cwd(), "openclaw.yaml");
      await fs.access(manifestPath);
      openClawAvailable = true;
    } catch {
      openClawAvailable = false;
    }

    const openClaw: JudgeOpenClawInfo = {
      available: openClawAvailable,
      manifestUrl: "/api/openclaw/manifest",
    };

    // --- Assemble integration evidence ---
    const integration: JudgeIntegrationInfo = {
      compute,
      storage,
      onChain,
      openClaw,
    };

    // --- Memory stats ---
    const allMemories = await getAllMemories();
    const zeroGBackedCount = allMemories.filter((m) =>
      m.storageUri?.startsWith("0g://")
    ).length;
    const sampleMemoryIds = allMemories.slice(0, 5).map((m) => m.id);

    const memory: JudgeMemoryStats = {
      totalRecords: allMemories.length,
      zeroGBackedCount,
      sampleMemoryIds,
    };

    // --- Assemble final response ---
    const judgeData: JudgeData = {
      projectName: projectInfo.projectName,
      track: projectInfo.track,
      description: projectInfo.description,
      network,
      integration,
      latestOnChainAnalysis,
      memory,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(judgeData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while generating judge data.";

    console.error("[Judge API] Error:", message);

    return NextResponse.json(
      {
        error: "Failed to generate judge data.",
        details: message,
      },
      {
        status: 500,
      }
    );
  }
}
