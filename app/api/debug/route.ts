// ---------------------------------------------------------------------------
// ClawMind — Debug API — shows configuration status without revealing secrets
// ---------------------------------------------------------------------------
// Use this to diagnose why on-chain transactions are not appearing.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  getStorageConfig,
  getNetworkConfig,
  getExplorerAddressUrl,
} from "@/lib/storage/zero-g-config";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { isRegistryConfigured, getLatestAnalysisFromChain } from "@/lib/contracts/analysis-registry";

export const dynamic = "force-dynamic";

function getDebugToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return request.headers.get("x-debug-token")?.trim() || null;
}

function isProductionDebugRequestAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const configuredToken = process.env.DEBUG_API_TOKEN?.trim();
  if (!configuredToken) {
    return false;
  }

  return getDebugToken(request) === configuredToken;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production" && !process.env.DEBUG_API_TOKEN?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isProductionDebugRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const networkConfig = getNetworkConfig();
  const storageConfig = getStorageConfig();
  const computeProvider = getComputeProviderLabel();
  const registryConfigured = isRegistryConfigured();

  const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;
  const hasPrivateKey = typeof process.env.ZERO_G_STORAGE_PRIVATE_KEY === "string"
    && process.env.ZERO_G_STORAGE_PRIVATE_KEY!.trim().length > 0;
  const storageEnabled = process.env.ZERO_G_STORAGE_ENABLED === "true";

  // Try reading from the contract to verify connection
  let contractReadResult: string | null = null;
  let contractReadError: string | null = null;

  if (contractAddress && contractAddress.startsWith("0x")) {
    try {
      const latest = await getLatestAnalysisFromChain();
      if (latest) {
        contractReadResult = `OK — found analysis from ${latest.submitter}`;
      } else {
        contractReadResult = "OK — contract reachable, no analyses yet";
      }
    } catch (error) {
      contractReadError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  // Try checking signer wallet balance
  let signerCheck: string | null = null;
  let signerError: string | null = null;

  if (hasPrivateKey && contractAddress) {
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider(networkConfig.evmRpc);
      const wallet = new ethers.Wallet(process.env.ZERO_G_STORAGE_PRIVATE_KEY!, provider);
      const address = await wallet.getAddress();
      const balance = await provider.getBalance(address);
      const balanceIn0G = ethers.formatEther(balance);

      signerCheck = `Wallet ${address} — Balance: ${balanceIn0G} 0G`;

      if (BigInt(balance.toString()) === BigInt(0)) {
        signerCheck += " — WARNING: ZERO BALANCE, cannot send transactions!";
      }
    } catch (error) {
      signerError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  const debug = {
    // Network
    network: {
      name: networkConfig.network,
      chainId: networkConfig.chainId,
      evmRpc: networkConfig.evmRpc,
      indexerRpc: networkConfig.indexerRpc,
      explorerBaseUrl: networkConfig.explorerBaseUrl,
    },

    // Compute
    compute: {
      provider: computeProvider,
      hasEndpoint: typeof process.env.ZERO_G_COMPUTE_ENDPOINT === "string" && process.env.ZERO_G_COMPUTE_ENDPOINT!.trim().length > 0,
      hasApiKey: typeof process.env.ZERO_G_COMPUTE_API_KEY === "string" && process.env.ZERO_G_COMPUTE_API_KEY!.trim().length > 0,
      model: process.env.ZERO_G_COMPUTE_MODEL ?? null,
    },

    // Storage
    storage: {
      enabled: storageEnabled,
      hasPrivateKey,
      isConfigured: storageConfig.isConfigured,
      provider: storageConfig.isConfigured ? "0G_STORAGE" : "LOCAL_FALLBACK",
    },

    // On-chain registry
    onChain: {
      registryConfigured,
      contractAddress,
      contractExplorerUrl: contractAddress
        ? getExplorerAddressUrl(contractAddress)
        : null,
      contractReadResult,
      contractReadError,
      signerCheck,
      signerError,
    },

    // Diagnosis
    diagnosis: [] as string[],

    timestamp: new Date().toISOString(),
  };

  // Auto-diagnosis
  if (!storageEnabled) {
    debug.diagnosis.push("ZERO_G_STORAGE_ENABLED is not set to 'true' — storage and on-chain will use fallback");
  }

  if (!hasPrivateKey) {
    debug.diagnosis.push("ZERO_G_STORAGE_PRIVATE_KEY is not set — cannot sign transactions or upload to 0G Storage");
  }

  if (!contractAddress) {
    debug.diagnosis.push("ZERO_G_ANALYSIS_REGISTRY_ADDRESS is not set — on-chain registration is disabled");
  } else if (!contractAddress.startsWith("0x")) {
    debug.diagnosis.push("ZERO_G_ANALYSIS_REGISTRY_ADDRESS doesn't start with '0x' — invalid address format");
  }

  if (storageEnabled && hasPrivateKey && !storageConfig.isConfigured) {
    debug.diagnosis.push("Storage is enabled and private key is set, but isConfigured is false — check private key value");
  }

  if (signerCheck?.includes("ZERO BALANCE")) {
    debug.diagnosis.push("Wallet has zero balance — you need 0G tokens to pay for gas on mainnet");
  }

  if (debug.diagnosis.length === 0 && registryConfigured) {
    debug.diagnosis.push("Everything looks configured correctly — on-chain registration should work after running an analysis");
  }

  return NextResponse.json(debug, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
