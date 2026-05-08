import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getNetworkConfig, getExplorerAddressUrl } from "@/lib/storage/zero-g-config";
import { isRegistryConfigured, getLatestAnalysisFromChain } from "@/lib/contracts/analysis-registry";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { getStorageConfig } from "@/lib/storage/zero-g-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  try {
    // Always read the raw YAML
    const manifestPath = path.join(process.cwd(), "openclaw.yaml");
    const yaml = await fs.readFile(manifestPath, "utf-8");

    // Default: return raw YAML
    if (format !== "json") {
      return new NextResponse(yaml, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Disposition": "inline; filename=\"openclaw.yaml\"",
        },
      });
    }

    // JSON format with live 0G evidence
    const networkConfig = getNetworkConfig();
    const storageConfig = getStorageConfig();
    const computeProvider = getComputeProviderLabel();
    const registryConfigured = isRegistryConfigured();
    const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

    let latestOnChain: Record<string, unknown> | null = null;
    if (contractAddress) {
      try {
        const latest = await getLatestAnalysisFromChain();
        if (latest) {
          latestOnChain = {
            analysisId: latest.submitter ? 1 : 0,
            rootHash: latest.rootHash,
            score: latest.score,
            recommendation: latest.recommendation,
            submitter: latest.submitter,
            timestamp: latest.timestamp,
            storageUri: latest.storageUri,
          };
        }
      } catch {
        // Contract read failed — skip
      }
    }

    const jsonManifest = {
      name: "clawmind",
      version: "1.0.0",
      kind: "agentic-infrastructure",
      track: "Track 1: Agentic Infrastructure & OpenClaw Lab",
      liveEvidence: {
        network: {
          name: networkConfig.network,
          chainId: networkConfig.chainId,
          explorerBaseUrl: networkConfig.explorerBaseUrl,
        },
        compute: {
          provider: computeProvider,
          isConfigured: computeProvider === "0G_COMPUTE",
        },
        storage: {
          provider: storageConfig.isConfigured ? "0G_STORAGE" : "LOCAL_FALLBACK",
          isConfigured: storageConfig.isConfigured,
        },
        onChain: {
          configured: registryConfigured,
          contractAddress,
          explorerUrl: contractAddress ? getExplorerAddressUrl(contractAddress) : null,
          latestAnalysis: latestOnChain,
        },
      },
      rawYaml: yaml,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(jsonManifest, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "OpenClaw manifest could not be loaded.", details: message },
      { status: 500 },
    );
  }
}
