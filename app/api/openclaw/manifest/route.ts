import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getNetworkConfig, getExplorerAddressUrl } from "@/lib/storage/zero-g-config";
import {
  getLatestAnalysisFromChain,
  getRegistryAuthStatus,
  isRegistryConfigured,
} from "@/lib/contracts/analysis-registry";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { getStorageConfig } from "@/lib/storage/zero-g-config";
import { loadAndValidateManifest } from "@/lib/openclaw/manifest-parser";
import { isSemanticRetrievalActive } from "@/lib/embeddings/embedding-provider";
import { getModelForAgent } from "@/lib/compute/model-router";

export const dynamic = "force-dynamic";

function getRuntimeModelForStep(stepId: string, declaredModel: string): string {
  if (stepId === "memory_retrieval") {
    return "all-MiniLM-L6-v2";
  }

  if (stepId === "memory_writer") {
    return "all-MiniLM-L6-v2 + 0G Storage";
  }

  return getModelForAgent(stepId).model || declaredModel;
}

function getModelFamily(model: string): string {
  if (model.includes("deepseek")) return "DeepSeek";
  if (model.includes("qwen")) return "Qwen";
  if (model.includes("GLM-5.1")) return "GLM-5.1";
  if (model.includes("GLM-5")) return "GLM-5";
  if (model.includes("MiniLM")) return "Local embeddings";
  return "Local";
}

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

    // JSON format with live 0G evidence + manifest validation
    const networkConfig = getNetworkConfig();
    const storageConfig = getStorageConfig();
    const computeProvider = getComputeProviderLabel();
    const registryConfigured = isRegistryConfigured();
    const contractAddress = process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? null;
    const registryAuthStatus = await getRegistryAuthStatus();

    // Load parsed manifest
    const { config, validation } = await loadAndValidateManifest();

    let latestOnChain: Record<string, unknown> | null = null;
    if (contractAddress) {
      try {
        const latest = await getLatestAnalysisFromChain();
        if (latest) {
          latestOnChain = {
            analysisId: latest.analysisId,
            rootHash: latest.rootHash,
            score: latest.score,
            recommendation: latest.recommendation,
            submitter: latest.submitter,
            timestamp: latest.timestamp,
            storageUri: latest.storageUri,
            taskHash: latest.taskHash,
            signatureVerified: latest.signatureVerified,
            registryMode: latest.registryMode,
          };
        }
      } catch {
        // Contract read failed — skip
      }
    }

    const runtimePipeline = config?.pipeline.map((step) => {
      const runtimeModel = getRuntimeModelForStep(step.id, step.model);

      return {
        id: step.id,
        label: step.label,
        skill: step.skill,
        model: runtimeModel,
        declaredModel: step.model,
        modelFamily: getModelFamily(runtimeModel),
        temperature: step.temperature,
        maxTokens: step.maxTokens,
        dependsOn: step.dependsOn,
        structuredOutput: step.structuredOutput,
      };
    }) ?? [];
    const runtimeComputeModels = Array.from(new Set(
      runtimePipeline
        .filter((step) => step.id !== "memory_retrieval" && step.id !== "memory_writer")
        .map((step) => step.model)
    ));

    const jsonManifest = {
      name: config?.name ?? "clawmind",
      version: config?.version ?? "2.0.0",
      kind: "agentic-infrastructure",
      track: "Track 1: Agentic Infrastructure & OpenClaw Lab",
      manifestValidation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        pipelineSteps: config?.pipeline.length ?? 0,
        modelStrategy: config?.strategy ?? "unknown",
      },
      pipeline: runtimePipeline,
      liveEvidence: {
        network: {
          name: networkConfig.network,
          chainId: networkConfig.chainId,
          explorerBaseUrl: networkConfig.explorerBaseUrl,
        },
        compute: {
          provider: computeProvider,
          isConfigured: computeProvider === "0G_COMPUTE",
          multiModelEnsemble: runtimeComputeModels.length > 1,
          models: runtimeComputeModels,
          declaredModels: config?.models.map((m) => m.id) ?? [],
          strategy:
            runtimeComputeModels.length > 1
              ? "agent_specific_model_routing"
              : "single_primary_model_route",
          envOverrideActive: Boolean(process.env.ZERO_G_COMPUTE_MODEL),
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
          operatorAuthentication:
            latestOnChain?.registryMode === "SIGNED_OPERATOR"
              ? {
                  mode: "EIP712_OPERATOR_SIGNATURE",
                  signatureVerified: latestOnChain.signatureVerified === true,
                  signedBy: latestOnChain.submitter,
                }
              : {
                  mode: registryAuthStatus.mode,
                  contractSupportsOperatorAuth: registryAuthStatus.contractSupportsOperatorAuth,
                  domainSeparator: registryAuthStatus.domainSeparator,
                  operatorAddress: registryAuthStatus.operatorAddress,
                  operatorAuthorized: registryAuthStatus.operatorAuthorized,
                  signatureVerified: registryAuthStatus.mode === "SIGNED_OPERATOR_READY",
                },
        },
        semanticMemory: {
          embeddingModel: "all-MiniLM-L6-v2",
          embeddingDimensions: 384,
          embeddingReady: isSemanticRetrievalActive(),
          retrievalMethod: "cosine_similarity_top_k",
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
