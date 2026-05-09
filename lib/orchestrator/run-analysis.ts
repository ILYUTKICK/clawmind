// ---------------------------------------------------------------------------
// ClawMind — Manifest-Driven Orchestrator with Model Fallback
// ---------------------------------------------------------------------------
// The pipeline is built from openclaw.yaml at startup.
// If the manifest is invalid, /api/analyze returns 503.
// Each agent uses its configured model from the manifest.
// If a model fails, automatic fallback kicks in (per-agent → global chain).
// ---------------------------------------------------------------------------

import { runArchitectAgent } from "@/lib/agents/architect";
import { runCriticAgent } from "@/lib/agents/critic";
import { runFinalAgent } from "@/lib/final-agent-wrapper";
import { runPlannerAgent } from "@/lib/agents/planner";
import { runResearchAgent } from "@/lib/agents/researcher";
import { runRiskAgent } from "@/lib/agents/risk-agent";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { formatMemoryContext, getRelevantMemories, saveGeneratedMemoryRecord } from "@/lib/memory/memory-manager";
import { rememberLatestMemoryIndexUri } from "@/lib/memory/persistent-memory-store";
import { saveAnalysisReceipt } from "@/lib/storage/storage-receipt";
import { saveMemoryIndexToZeroGStorage } from "@/lib/storage/zero-g-memory-index";
import { recordAnalysisOnChain, buildOnChainReceipt } from "@/lib/contracts/analysis-registry";
import {
  loadAndValidateManifest,
  getStepConfig,
  getModelDisplayName,
  type ManifestConfig,
  type ManifestValidationResult,
} from "@/lib/openclaw/manifest-parser";
import { AgentName, AgentStep, AnalysisResult } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

function createCompletedStep(
  name: AgentName,
  label: string,
  input: string,
  output: string,
  model?: string,
  modelFamily?: string
): AgentStep {
  const startedAt = nowIso();
  const finishedAt = nowIso();

  return {
    name,
    label,
    status: "completed",
    input,
    output,
    startedAt,
    finishedAt,
    model,
    modelFamily,
  };
}

// ---------------------------------------------------------------------------
// Agent execution map — maps manifest step id to TS function
// ---------------------------------------------------------------------------

type AgentContext = {
  task: string;
  memoryContext: string;
  relevantMemories: unknown[];
  plan: string;
  researchOutput: string;
  riskOutput: string;
  architectureOutput: string;
  critiqueOutput: string;
  finalResult?: { rawOutput: string; report: unknown };
  receipt?: unknown;
};

type AgentFunction = (
  ctx: AgentContext,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  fallbackModel?: string,
  fallbackChain?: string[]
) => Promise<string>;

const agentMap: Record<string, AgentFunction> = {
  async planner(ctx, model, temperature, maxTokens, fallbackModel, fallbackChain) {
    return runPlannerAgent(ctx.task, ctx.memoryContext, model, temperature, maxTokens, fallbackModel, fallbackChain);
  },
  async researcher(ctx, model, temperature, maxTokens, fallbackModel, fallbackChain) {
    return runResearchAgent(ctx.task, ctx.plan, model, temperature, maxTokens, fallbackModel, fallbackChain);
  },
  async risk_agent(ctx, model, temperature, maxTokens, fallbackModel, fallbackChain) {
    return runRiskAgent(ctx.task, ctx.researchOutput, ctx.memoryContext, model, temperature, maxTokens, fallbackModel, fallbackChain);
  },
  async architect(ctx, model, temperature, maxTokens, fallbackModel, fallbackChain) {
    return runArchitectAgent(ctx.task, ctx.researchOutput, ctx.riskOutput, model, temperature, maxTokens, fallbackModel, fallbackChain);
  },
  async critic(ctx, model, temperature, maxTokens, fallbackModel, fallbackChain) {
    return runCriticAgent(ctx.task, ctx.plan, ctx.researchOutput, ctx.riskOutput, ctx.architectureOutput, model, temperature, maxTokens, fallbackModel, fallbackChain);
  },
  async final_agent(ctx, model, temperature, maxTokens, fallbackModel, fallbackChain) {
    const result = await runFinalAgent({
      task: ctx.task,
      memories: ctx.relevantMemories as any[],
      plan: ctx.plan,
      researchOutput: ctx.researchOutput,
      riskOutput: ctx.riskOutput,
      architectureOutput: ctx.architectureOutput,
      critiqueOutput: ctx.critiqueOutput,
      model,
      temperature,
      maxTokens,
      fallbackModel,
      fallbackChain,
    });
    ctx.finalResult = result;
    return result.rawOutput;
  },
};

// ---------------------------------------------------------------------------
// Manifest validation check — call from API route
// ---------------------------------------------------------------------------

let lastValidation: ManifestValidationResult | null = null;

export async function checkManifestValid(): Promise<{
  valid: boolean;
  config: ManifestConfig | null;
  validation: ManifestValidationResult | null;
}> {
  try {
    const { config, validation } = await loadAndValidateManifest();
    lastValidation = validation;
    return { valid: validation.valid, config, validation };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      config: null,
      validation: {
        valid: false,
        errors: [`Cannot load openclaw.yaml: ${message}`],
        warnings: [],
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runAnalysis(task: string): Promise<AnalysisResult> {
  const steps: AgentStep[] = [];
  const computeProvider = getComputeProviderLabel();

  // Load manifest
  const { config, validation } = await checkManifestValid();

  if (!config || !validation?.valid) {
    throw new Error(
      `OpenClaw manifest invalid — pipeline cannot start. Errors: ${validation?.errors?.join("; ") ?? "unknown"}`
    );
  }

  console.log(`[Orchestrator] Pipeline: ${config.pipeline.map((s) => s.id).join(" → ")}`);
  console.log(`[Orchestrator] Strategy: ${config.strategy}`);
  console.log(`[Orchestrator] Fallback chain: [${config.fallbackChain.join(", ")}]`);

  const modelRouting: Record<string, string> = {};

  // Build context object that accumulates as pipeline progresses
  const ctx: AgentContext = {
    task,
    memoryContext: "",
    relevantMemories: [],
    plan: "",
    researchOutput: "",
    riskOutput: "",
    architectureOutput: "",
    critiqueOutput: "",
  };

  // Execute pipeline steps in manifest order
  for (const stepConfig of config.pipeline) {
    const stepId = stepConfig.id as AgentName;
    const stepStart = nowIso();

    // ── Memory Retrieval (special — not an LLM agent) ──
    if (stepId === "memory_retrieval") {
      const relevantMemories = await getRelevantMemories(task);
      const memoryContext = formatMemoryContext(relevantMemories);

      ctx.memoryContext = memoryContext;
      ctx.relevantMemories = relevantMemories;

      steps.push({
        name: "memory_retrieval",
        label: stepConfig.label,
        status: "completed",
        input: task,
        output: [
          `Found ${relevantMemories.length} relevant memory record(s).`,
          "Memory source: local cache + 0G Storage memory index + embedding-based semantic retrieval.",
          memoryContext,
        ].join("\n"),
        startedAt: stepStart,
        finishedAt: nowIso(),
        model: "local (embedding)",
        modelFamily: "Embedding",
      });

      modelRouting[stepId] = "all-MiniLM-L6-v2 (embedding)";
      continue;
    }

    // ── Memory Writer (special — post-processing, not an LLM agent) ──
    if (stepId === "memory_writer") {
      // This step is handled after the loop (below)
      continue;
    }

    // ── Regular LLM agents ──
    const agentFn = agentMap[stepId];
    if (!agentFn) {
      console.warn(`[Orchestrator] No agent function for step '${stepId}' — skipping.`);
      steps.push({
        name: stepId,
        label: stepConfig.label,
        status: "failed",
        input: task,
        error: `No agent function mapped for '${stepId}'.`,
        startedAt: stepStart,
        finishedAt: nowIso(),
        model: stepConfig.model,
        modelFamily: getModelDisplayName(stepConfig.model),
      });
      continue;
    }

    // Log model assignment + fallback
    const modelDisplayName = getModelDisplayName(stepConfig.model);
    const fallbackDisplayName = getModelDisplayName(stepConfig.fallbackModel);
    console.log(
      `[Orchestrator] Running ${stepId} → ${stepConfig.model} (${modelDisplayName}) [fallback: ${stepConfig.fallbackModel} (${fallbackDisplayName})] [temp=${stepConfig.temperature}, max_tokens=${stepConfig.maxTokens}]`
    );

    try {
      const output = await agentFn(
        ctx,
        stepConfig.model,
        stepConfig.temperature,
        stepConfig.maxTokens,
        stepConfig.fallbackModel,
        config.fallbackChain
      );

      // Update context based on step output
      switch (stepId) {
        case "planner":
          ctx.plan = output;
          break;
        case "researcher":
          ctx.researchOutput = output;
          break;
        case "risk_agent":
          ctx.riskOutput = output;
          break;
        case "architect":
          ctx.architectureOutput = output;
          break;
        case "critic":
          ctx.critiqueOutput = output;
          break;
      }

      steps.push(
        createCompletedStep(
          stepId,
          stepConfig.label,
          task,
          output,
          stepConfig.model,
          modelDisplayName
        )
      );

      modelRouting[stepId] = stepConfig.model;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] ${stepId} failed: ${message}`);

      steps.push({
        name: stepId,
        label: stepConfig.label,
        status: "failed",
        input: task,
        error: message,
        startedAt: stepStart,
        finishedAt: nowIso(),
        model: stepConfig.model,
        modelFamily: modelDisplayName,
      });

      // If a non-optional step fails, we still continue with fallback data
      // The final agent will generate a fallback report if needed
    }
  }

  // ── Post-pipeline: Storage, Memory, On-chain ──

  // Get final report from context
  const finalResult = ctx.finalResult;
  if (!finalResult) {
    throw new Error("Pipeline completed but no final report was generated.");
  }

  // Step 8: Persist report to 0G Storage
  const receipt = await saveAnalysisReceipt({
    task,
    report: finalResult.report as any,
  });

  // Step 9: Generate and persist memory record + memory index
  const generatedMemoryResult = await saveGeneratedMemoryRecord({
    task,
    report: finalResult.report as any,
    storageUri: receipt.storageUri,
  });

  const memoryIndexReceipt = await saveMemoryIndexToZeroGStorage({
    memories: generatedMemoryResult.memories,
  });

  await rememberLatestMemoryIndexUri(memoryIndexReceipt.storageUri);

  // Step 10: On-chain registration
  console.log("[Orchestrator] Step 10: On-chain registration attempt...");
  console.log(`[Orchestrator]   Network: ${process.env.ZERO_G_NETWORK ?? "testnet (default)"}`);
  console.log(`[Orchestrator]   Contract: ${process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? "NOT SET"}`);

  const onChainResult = await recordAnalysisOnChain({
    rootHash: receipt.reportHash,
    storageUri: receipt.storageUri ?? "",
    score: (finalResult.report as any).score,
    recommendation: (finalResult.report as any).recommendation,
  });

  if (onChainResult) {
    console.log(`[Orchestrator]   ✓ On-chain tx SUCCESS: ${onChainResult.txHash} (block ${onChainResult.blockNumber})`);
  } else {
    console.warn("[Orchestrator]   ✗ On-chain registration SKIPPED — check .env configuration");
  }

  const onChainReceipt = buildOnChainReceipt(
    onChainResult,
    process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS
  );

  // Build memory writer step output
  const memoryWriterLines = [
    `Saved analysis through ${receipt.provider}.`,
    `Compute provider: ${computeProvider}.`,
    `Report hash: ${receipt.reportHash}.`,
    `Report URI: ${receipt.storageUri ?? "not available"}.`,
    `Generated persistent memory: ${generatedMemoryResult.memory.id}.`,
    `Memory index provider: ${memoryIndexReceipt.provider}.`,
    `Memory index hash: ${memoryIndexReceipt.reportHash}.`,
    `On-chain registry: ${onChainReceipt.provider}.`,
  ];

  if (onChainReceipt.provider === "0G_CHAIN") {
    memoryWriterLines.push(
      `On-chain analysis ID: ${onChainReceipt.analysisId}.`,
      `On-chain tx: ${onChainReceipt.explorerTxUrl || onChainReceipt.txHash}.`,
      `Contract: ${onChainReceipt.contractAddress}.`
    );
  }

  memoryWriterLines.push(
    "If the memory index URI starts with 0g://, later runs can load it through ZERO_G_MEMORY_INDEX_URI or the local latest-memory-index-uri.txt pointer."
  );

  // Find the memory_writer step config for model info
  const memoryWriterConfig = getStepConfig(config, "memory_writer");

  steps.push(
    createCompletedStep(
      "memory_writer",
      "Memory Writer",
      JSON.stringify(
        {
          report: finalResult.report,
          memory: generatedMemoryResult.memory,
          memoryIndexReceipt,
          onChainReceipt,
        },
        null,
        2,
      ),
      memoryWriterLines.join(" "),
      memoryWriterConfig?.model ?? "deepseek/deepseek-chat-v3-0324",
      getModelDisplayName(memoryWriterConfig?.model ?? "deepseek/deepseek-chat-v3-0324"),
    ),
  );

  return {
    task,
    steps,
    relevantMemories: ctx.relevantMemories as any[],
    report: finalResult.report as any,
    receipt,
    memoryIndexReceipt,
    onChainReceipt,
    modelRouting,
  };
}
