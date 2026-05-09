// ---------------------------------------------------------------------------
// ClawMind — Debug API — shows configuration status without revealing secrets
// ---------------------------------------------------------------------------
// Use this to diagnose why on-chain transactions are not appearing.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getInfrastructureStatus } from "@/lib/infrastructure-status";
import { getLatestAnalysisFromChain } from "@/lib/contracts/analysis-registry";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const infra = await getInfrastructureStatus();

  // --- Debug-specific: check signer wallet balance ---
  const hasPrivateKey =
    typeof process.env.ZERO_G_STORAGE_PRIVATE_KEY === "string" &&
    process.env.ZERO_G_STORAGE_PRIVATE_KEY!.trim().length > 0;

  // Try reading from the contract to verify connection
  let contractReadResult: string | null = null;
  let contractReadError: string | null = null;

  if (infra.onChain.contractAddress && infra.onChain.contractAddress.startsWith("0x")) {
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

  if (hasPrivateKey && infra.onChain.contractAddress) {
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider(infra.network.evmRpc);
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
      name: infra.network.name,
      chainId: infra.network.chainId,
      evmRpc: infra.network.evmRpc,
      indexerRpc: infra.network.indexerRpc,
      explorerBaseUrl: infra.network.explorerBaseUrl,
    },

    // Compute
    compute: {
      provider: infra.compute.provider,
      hasEndpoint: typeof process.env.ZERO_G_COMPUTE_ENDPOINT === "string" && process.env.ZERO_G_COMPUTE_ENDPOINT!.trim().length > 0,
      hasApiKey: typeof process.env.ZERO_G_COMPUTE_API_KEY === "string" && process.env.ZERO_G_COMPUTE_API_KEY!.trim().length > 0,
      model: infra.compute.model,
    },

    // Storage
    storage: {
      enabled: infra.storage.isEnabled,
      hasPrivateKey,
      isConfigured: infra.storage.isConfigured,
      provider: infra.storage.provider,
    },

    // On-chain registry
    onChain: {
      registryConfigured: infra.onChain.configured,
      contractAddress: infra.onChain.contractAddress,
      contractExplorerUrl: infra.onChain.explorerUrl,
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
  if (!infra.storage.isEnabled) {
    debug.diagnosis.push("ZERO_G_STORAGE_ENABLED is not set to 'true' — storage and on-chain will use fallback");
  }

  if (!hasPrivateKey) {
    debug.diagnosis.push("ZERO_G_STORAGE_PRIVATE_KEY is not set — cannot sign transactions or upload to 0G Storage");
  }

  if (!infra.onChain.contractAddress) {
    debug.diagnosis.push("ZERO_G_ANALYSIS_REGISTRY_ADDRESS is not set — on-chain registration is disabled");
  } else if (!infra.onChain.contractAddress.startsWith("0x")) {
    debug.diagnosis.push("ZERO_G_ANALYSIS_REGISTRY_ADDRESS doesn't start with '0x' — invalid address format");
  }

  if (infra.storage.isEnabled && hasPrivateKey && !infra.storage.isConfigured) {
    debug.diagnosis.push("Storage is enabled and private key is set, but isConfigured is false — check private key value");
  }

  if (signerCheck?.includes("ZERO BALANCE")) {
    debug.diagnosis.push("Wallet has zero balance — you need 0G tokens to pay for gas on mainnet");
  }

  if (debug.diagnosis.length === 0 && infra.onChain.configured) {
    debug.diagnosis.push("Everything looks configured correctly — on-chain registration should work after running an analysis");
  }

  return NextResponse.json(debug, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
