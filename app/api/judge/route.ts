// ---------------------------------------------------------------------------
// ClawMind — Judge API Endpoint
// ---------------------------------------------------------------------------
// Returns all the evidence a hackathon judge needs on a single read-only page,
// without requiring any wallet connection or running an analysis.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  getLatestAnalysisFromChain,
  ANALYSIS_REGISTRY_ABI,
} from "@/lib/contracts/analysis-registry";
import { getInfrastructureStatus } from "@/lib/infrastructure-status";
import { getExplorerAddressUrl } from "@/lib/storage/zero-g-config";
import { getAllMemories, getRelevantMemories } from "@/lib/memory/memory-manager";
import { isSemanticRetrievalActive } from "@/lib/embeddings/embedding-provider";
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
  manifestValid: boolean;
  pipelineSteps: number;
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
  taskHash?: string;
  signature?: string;
  signatureVerified?: boolean;
  registryMode?: "SIGNED_OPERATOR" | "LEGACY_UNAUTHENTICATED";
};

type JudgeRecentAnalysis = {
  analysisId: number;
  rootHash: string;
  score: number;
  recommendation: string;
  timestamp: number;
  explorerUrl: string;
};

type JudgeAnalysesPerHour = {
  hour: string;
  count: number;
};

type JudgeMemoryStats = {
  totalRecords: number;
  zeroGBackedCount: number;
  sampleMemoryIds: string[];
  semanticRetrievalActive: boolean;
  semanticRetrievalExample: string | null;
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

  // Live dashboard fields
  analysisCount: number;
  recentAnalyses: JudgeRecentAnalysis[];
  analysesPerHour: JudgeAnalysesPerHour[];

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
    // Import getNetworkConfig locally to avoid circular dependency concerns
    const { getNetworkConfig } = await import("@/lib/storage/zero-g-config");
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
// Helper: get recent analyses from the on-chain registry
// ---------------------------------------------------------------------------

async function getRecentAnalysesFromChain(
  count: number
): Promise<JudgeRecentAnalysis[]> {
  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS;

  if (!contractAddress || !contractAddress.startsWith("0x") || count === 0) {
    return [];
  }

  try {
    const { ethers } = await import("ethers");
    const { getNetworkConfig } = await import("@/lib/storage/zero-g-config");
    const networkConfig = getNetworkConfig();
    const provider = new ethers.JsonRpcProvider(networkConfig.evmRpc);
    const contract = new ethers.Contract(
      contractAddress,
      ANALYSIS_REGISTRY_ABI,
      provider
    );

    const limit = Math.min(count, 10);
    const startId = count; // Contract analysis IDs are 1-based.
    const endId = Math.max(1, count - limit + 1);
    const analyses: JudgeRecentAnalysis[] = [];

    // Read from newest down to oldest.
    for (let i = startId; i >= endId; i--) {
      try {
        const [, rootHash, , score, recommendation, timestamp] =
          await contract.getAnalysis(i);

        analyses.push({
          analysisId: i,
          rootHash,
          score: Number(score),
          recommendation,
          timestamp: Number(timestamp),
          explorerUrl: getExplorerAddressUrl(contractAddress),
        });
      } catch {
        // Individual analysis read may fail; skip it
      }
    }

    return analyses;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helper: compute analyses-per-hour for the last 24 hours
// ---------------------------------------------------------------------------

function computeAnalysesPerHour(
  analyses: JudgeRecentAnalysis[]
): JudgeAnalysesPerHour[] {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const buckets: Map<string, number> = new Map();

  // Initialize all 24 buckets
  for (let i = 23; i >= 0; i--) {
    const bucketTime = new Date(now - i * hourMs);
    const hourLabel = `${bucketTime.getUTCHours().toString().padStart(2, "0")}:00`;
    const key = `${bucketTime.getUTCFullYear()}-${(bucketTime.getUTCMonth() + 1).toString().padStart(2, "0")}-${bucketTime.getUTCDate().toString().padStart(2, "0")}T${hourLabel}`;
    buckets.set(key, 0);
  }

  // Count analyses into buckets
  for (const a of analyses) {
    const tsMs = a.timestamp * 1000;
    const age = now - tsMs;
    if (age < 0 || age > 24 * hourMs) continue;

    const d = new Date(tsMs);
    const hourLabel = `${d.getUTCHours().toString().padStart(2, "0")}:00`;
    const key = `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}T${hourLabel}`;

    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  // Convert to array, using just the hour portion as label
  return Array.from(buckets.entries()).map(([key, count]) => {
    const hourPart = key.split("T")[1];
    return { hour: hourPart ?? key, count };
  });
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    // --- Project info from openclaw.yaml ---
    const projectInfo = await getProjectInfo();

    // --- Base infrastructure status from shared helper ---
    const infra = await getInfrastructureStatus();

    const network: JudgeNetworkInfo = {
      name: infra.network.name,
      chainId: infra.network.chainId,
      explorerBaseUrl: infra.network.explorerBaseUrl,
    };

    // --- Compute integration evidence ---
    const compute: JudgeComputeInfo = {
      provider: infra.compute.provider,
      status: infra.compute.isConfigured ? "active" : "fallback",
    };

    // --- Storage integration evidence ---
    const storage: JudgeStorageInfo = {
      configured: infra.storage.isConfigured,
      provider: infra.storage.provider,
      network: infra.storage.network,
    };

    // --- On-chain integration evidence ---
    let latestOnChainAnalysis: JudgeLatestOnChainAnalysis | null = null;
    let latestAnalysisRaw: Record<string, unknown> | null = null;

    if (infra.onChain.contractAddress && infra.onChain.contractAddress.startsWith("0x")) {
      const analysisFromChain = await getLatestAnalysisFromChain();

      if (analysisFromChain) {
        latestAnalysisRaw = analysisFromChain as unknown as Record<
          string,
          unknown
        >;

        // Get the analysis count to derive the latest analysisId
        const analysisCount = await getAnalysisCountFromChain();
        const analysisId = analysisCount > 0 ? analysisCount : 0;

        // The explorerTxUrl should link to the contract address page so judges
        // can see all registered transactions — individual tx hashes are not
        // available from a read-only getLatestAnalysis call.
        const contractExplorerUrl = infra.onChain.explorerUrl;

        latestOnChainAnalysis = {
          analysisId,
          rootHash: analysisFromChain.rootHash,
          storageUri: analysisFromChain.storageUri,
          score: analysisFromChain.score,
          recommendation: analysisFromChain.recommendation,
          timestamp: analysisFromChain.timestamp,
          submitter: analysisFromChain.submitter,
          explorerTxUrl: contractExplorerUrl ?? "",
          taskHash: analysisFromChain.taskHash,
          signature: analysisFromChain.signature,
          signatureVerified: analysisFromChain.signatureVerified,
          registryMode: analysisFromChain.registryMode,
        };
      }
    }

    const onChain: JudgeOnChainInfo = {
      configured: infra.onChain.configured,
      contractAddress: infra.onChain.contractAddress,
      explorerUrl: infra.onChain.explorerUrl,
      latestAnalysis: latestAnalysisRaw,
    };

    // --- OpenClaw evidence ---
    const openClaw: JudgeOpenClawInfo = {
      available: infra.openClaw.available,
      manifestValid: infra.openClaw.manifestValid,
      pipelineSteps: infra.openClaw.pipelineSteps,
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
    const semanticExampleMemories = await getRelevantMemories(
      "Self-custodial agent that auto-trades user funds with no withdrawal guards"
    );
    const semanticRetrievalExample =
      semanticExampleMemories.length > 0
        ? `Last task retrieved memories [${semanticExampleMemories
            .map((m) =>
              `${m.id}${m.similarityScore !== undefined ? ` (sim ${m.similarityScore.toFixed(2)})` : ""}`
            )
            .join(", ")}]`
        : null;

    const memory: JudgeMemoryStats = {
      totalRecords: allMemories.length,
      zeroGBackedCount,
      sampleMemoryIds,
      semanticRetrievalActive: isSemanticRetrievalActive(),
      semanticRetrievalExample,
    };

    // --- Analysis count ---
    const analysisCount = await getAnalysisCountFromChain();

    // --- Recent analyses ---
    const recentAnalyses = await getRecentAnalysesFromChain(analysisCount);

    // --- Analyses per hour (last 24h) ---
    const analysesPerHour = computeAnalysesPerHour(recentAnalyses);

    // --- Assemble final response ---
    const judgeData: JudgeData = {
      projectName: projectInfo.projectName,
      track: projectInfo.track,
      description: projectInfo.description,
      network,
      integration,
      latestOnChainAnalysis,
      analysisCount,
      recentAnalyses,
      analysesPerHour,
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
