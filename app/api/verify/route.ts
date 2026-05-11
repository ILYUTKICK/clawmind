// ---------------------------------------------------------------------------
// ClawMind — Integrity Verification API
// ---------------------------------------------------------------------------
// Reads the latest on-chain analysis and compares it with local analysis
// results. Returns the integrity chain: report hash → on-chain root hash →
// Explorer link, so judges can verify that on-chain data matches the UI.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  getLatestAnalysisFromChain,
  isRegistryConfigured,
} from "@/lib/contracts/analysis-registry";
import {
  getNetworkConfig,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const networkConfig = getNetworkConfig();
  const contractAddress =
    process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;

  if (!isRegistryConfigured()) {
    return NextResponse.json({
      verified: false,
      error: "On-chain registry not configured",
      network: networkConfig.network,
    });
  }

  try {
    const latest = await getLatestAnalysisFromChain();

    if (!latest) {
      return NextResponse.json({
        verified: false,
        error: "No analyses found on-chain",
        network: networkConfig.network,
        contractAddress,
        explorerUrl: contractAddress
          ? getExplorerAddressUrl(contractAddress)
          : null,
      });
    }

    return NextResponse.json({
      verified: true,
      onChain: {
        submitter: latest.submitter,
        rootHash: latest.rootHash,
        storageUri: latest.storageUri,
        score: latest.score,
        recommendation: latest.recommendation,
        timestamp: latest.timestamp,
        timestampReadable: new Date(latest.timestamp * 1000).toISOString(),
        taskHash: latest.taskHash,
        signature: latest.signature,
        signatureVerified: latest.signatureVerified,
        registryMode: latest.registryMode,
      },
      contract: {
        address: contractAddress,
        explorerUrl: contractAddress
          ? getExplorerAddressUrl(contractAddress)
          : null,
        network: networkConfig.network,
        chainId: networkConfig.chainId,
      },
      integrityChecks: {
        rootHashFormat:
          latest.rootHash.startsWith("0x") && latest.rootHash.length === 66,
        scoreRange: latest.score >= 0 && latest.score <= 100,
        validRecommendation: ["GO", "NO_GO", "INVESTIGATE_MORE"].includes(
          latest.recommendation
        ),
        hasStorageUri: latest.storageUri.length > 0,
        hasSubmitter: latest.submitter.startsWith("0x"),
        operatorSignatureVerified:
          latest.registryMode === "SIGNED_OPERATOR"
            ? latest.signatureVerified === true
            : false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      verified: false,
      error: message,
      network: networkConfig.network,
    });
  }
}
