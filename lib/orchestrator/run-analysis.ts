// ---------------------------------------------------------------------------
// ClawMind — Manifest-Driven Orchestrator with Structured Output Validation
// ---------------------------------------------------------------------------
// The pipeline is built from openclaw.yaml at startup.
// If the manifest is invalid, /api/analyze returns 503.
// Each agent uses its configured model from the manifest.
// All agent outputs are validated with Zod schemas + retry cascade.
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
import { withStructuredOutput, getStructuredOutputInstructions } from "@/lib/structured-output/with-structured-output";
import type { PlannerOutput } from "@/lib/structured-output/schemas";
import type { ResearcherOutput } from "@/lib/structured-output/schemas";
import type { RiskOutput } from "@/lib/structured-output/schemas";
import type { ArchitectOutput } from "@/lib/structured-output/schemas";
import type { CriticOutput } from "@/lib/structured-output/schemas";
import type { FinalOutput } from "@/lib/structured-output/schemas";
import {
  loadAndValidateManifest,
  getStepConfig,
  getModelDisplayName,
  type ManifestConfig,
  type ManifestValidationResult,
} from "@/lib/openclaw/manifest-parser";
import { AgentName, AgentStep, AnalysisResult, ValidationMode } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

function createCompletedStep(
  name: AgentName,
  label: string,
  input: string,
  output: string,
  model?: string,
  modelFamily?: string,
  modelId?: string,
  validation?: AgentStep["validation"]
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
    modelId,
    validation,
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
  // Structured outputs from each agent
  structuredPlan: PlannerOutput | null;
  structuredResearch: ResearcherOutput | null;
  structuredRisks: RiskOutput | null;
  structuredArchitecture: ArchitectOutput | null;
  structuredCritique: CriticOutput | null;
  structuredFinal: FinalOutput | null;
};

type AgentFunction = (ctx: AgentContext, model?: string, temperature?: number, maxTokens?: number) => Promise<string>;

const agentMap: Record<string, AgentFunction> = {
  async planner(ctx, model, temperature, maxTokens) {
    return runPlannerAgent(ctx.task, ctx.memoryContext, model, temperature, maxTokens);
  },
  async researcher(ctx, model, temperature, maxTokens) {
    return runResearchAgent(ctx.task, ctx.plan, model, temperature, maxTokens);
  },
  async risk_agent(ctx, model, temperature, maxTokens) {
    return runRiskAgent(ctx.task, ctx.researchOutput, ctx.memoryContext, model, temperature, maxTokens);
  },
  async architect(ctx, model, temperature, maxTokens) {
    return runArchitectAgent(ctx.task, ctx.researchOutput, ctx.riskOutput, model, temperature, maxTokens);
  },
  async critic(ctx, model, temperature, maxTokens) {
    return runCriticAgent(ctx.task, ctx.plan, ctx.researchOutput, ctx.riskOutput, ctx.architectureOutput, model, temperature, maxTokens);
  },
  async final_agent(ctx, model, temperature, maxTokens) {
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
// Build human-readable output from structured data
// ---------------------------------------------------------------------------

function formatPlanOutput(structured: PlannerOutput | null, raw: string): string {
  if (structured) {
    return [
      "Execution Plan:",
      ...structured.steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      `Reasoning: ${structured.reasoning}`,
    ].join("\n");
  }
  return raw;
}

function formatResearchOutput(structured: ResearcherOutput | null, raw: string): string {
  if (structured) {
    const lines: string[] = ["Research Findings:"];
    if (structured.facts.length > 0) {
      lines.push("", "Facts:");
      lines.push(...structured.facts.map((f) => `- ${f}`));
    }
    if (structured.assumptions.length > 0) {
      lines.push("", "Assumptions:");
      lines.push(...structured.assumptions.map((a) => `- ${a}`));
    }
    if (structured.missingContext.length > 0) {
      lines.push("", "Missing Context:");
      lines.push(...structured.missingContext.map((m) => `- ${m}`));
    }
    return lines.join("\n");
  }
  return raw;
}

function formatRiskOutput(structured: RiskOutput | null, raw: string): string {
  if (structured) {
    return [
      "Risk Map:",
      ...structured.risks.map(
        (r) => `- [${r.severity.toUpperCase()}] ${r.title}: ${r.explanation}`
      ),
    ].join("\n");
  }
  return raw;
}

function formatArchitectOutput(structured: ArchitectOutput | null, raw: string): string {
  if (structured) {
    const lines: string[] = ["Architecture Recommendations:"];
    lines.push(...structured.recommendations.map((r) => `- ${r}`));
    if (structured.components.length > 0) {
      lines.push("", "System Components:");
      lines.push(...structured.components.map((c) => `- ${c}`));
    }
    return lines.join("\n");
  }
  return raw;
}

function formatCritiqueOutput(structured: CriticOutput | null, raw: string): string {
  if (structured) {
    const lines: string[] = ["Critique:"];
    if (structured.critiques.length > 0) {
      lines.push(...structured.critiques.map((c) => `- ${c}`));
    }
    if (structured.missingSafeguards.length > 0) {
      lines.push("", "Missing Safeguards:");
      lines.push(...structured.missingSafeguards.map((s) => `- ${s}`));
    }
    if (structured.improvements.length > 0) {
      lines.push("", "Suggested Improvements:");
      lines.push(...structured.improvements.map((imp) => `- ${imp}`));
    }
    return lines.join("\n");
  }
  return raw;
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

  console.log(`[Orchestrator] Pipeline: ${config.pipeline.map((s) => s.id).join(" -> ")}`);
  console.log(`[Orchestrator] Strategy: ${config.strategy}`);

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
    structuredPlan: null,
    structuredResearch: null,
    structuredRisks: null,
    structuredArchitecture: null,
    structuredCritique: null,
    structuredFinal: null,
  };

  // Execute pipeline steps in manifest order
  for (const stepConfig of config.pipeline) {
    const stepId = stepConfig.id as AgentName;
    const stepStart = nowIso();

    // -- Memory Retrieval (special -- not an LLM agent) --
    if (stepId === "memory_retrieval") {
      const relevantMemories = await getRelevantMemories(task);
      const memoryContext = formatMemoryContext(relevantMemories);

      ctx.memoryContext = memoryContext;
      ctx.relevantMemories = relevantMemories;

      // Log similarity scores for each retrieved memory
      const similarityLog = relevantMemories
        .filter((m: any) => m.similarityScore !== undefined)
        .map((m: any) => `${m.id} (${(m.similarityScore * 100).toFixed(0)}% match)`)
        .join(", ");

      steps.push({
        name: "memory_retrieval",
        label: stepConfig.label,
        status: "completed",
        input: task,
        output: [
          `Found ${relevantMemories.length} relevant memory record(s).`,
          "Memory source: local cache + 0G Storage memory index + embedding-based semantic retrieval.",
          similarityLog ? `Similarity: ${similarityLog}` : "",
          memoryContext,
        ].filter(Boolean).join("\n"),
        startedAt: stepStart,
        finishedAt: nowIso(),
        model: "local (embedding)",
        modelFamily: "Embedding",
        modelId: "all-MiniLM-L6-v2",
        validation: {
          validated: true,
          retriesUsed: 0,
          mode: "NO_SCHEMA" as ValidationMode,
          finalModel: "local",
          errors: [],
        },
      });

      modelRouting[stepId] = "all-MiniLM-L6-v2 (embedding)";
      continue;
    }

    // -- Memory Writer (special -- post-processing, not an LLM agent) --
    if (stepId === "memory_writer") {
      // This step is handled after the loop (below)
      continue;
    }

    // -- Regular LLM agents --
    const agentFn = agentMap[stepId];
    if (!agentFn) {
      console.warn(`[Orchestrator] No agent function for step '${stepId}' -- skipping.`);
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
        modelId: stepConfig.model,
      });
      continue;
    }

    // Log model assignment
    const modelDisplayName = getModelDisplayName(stepConfig.model);
    console.log(
      `[Orchestrator] Running ${stepId} -> ${stepConfig.model} (${modelDisplayName}) [temp=${stepConfig.temperature}, max_tokens=${stepConfig.maxTokens}]`
    );

    try {
      const rawOutput = await agentFn(
        ctx,
        stepConfig.model,
        stepConfig.temperature,
        stepConfig.maxTokens
      );

      // -- Structured Output Validation --
      let displayOutput = rawOutput;
      let validationResult: AgentStep["validation"] = undefined;

      if (stepConfig.structuredOutput) {
        // Validate ALL agent outputs that have schemas
        const structuredResult = await withStructuredOutput(
          stepId,
          rawOutput,
          stepConfig.model,
          stepConfig.temperature,
          stepConfig.maxTokens
        );

        validationResult = {
          validated: structuredResult.success,
          retriesUsed: structuredResult.retriesUsed,
          mode: structuredResult.mode as ValidationMode,
          finalModel: structuredResult.finalModel,
          errors: structuredResult.validationErrors,
          structuredData: structuredResult.data,
        };

        // Use structured data to build formatted output
        if (structuredResult.success && structuredResult.data) {
          switch (stepId) {
            case "planner": {
              const data = structuredResult.data as PlannerOutput;
              ctx.structuredPlan = data;
              displayOutput = formatPlanOutput(data, rawOutput);
              break;
            }
            case "researcher": {
              const data = structuredResult.data as ResearcherOutput;
              ctx.structuredResearch = data;
              displayOutput = formatResearchOutput(data, rawOutput);
              break;
            }
            case "risk_agent": {
              const data = structuredResult.data as RiskOutput;
              ctx.structuredRisks = data;
              displayOutput = formatRiskOutput(data, rawOutput);
              break;
            }
            case "architect": {
              const data = structuredResult.data as ArchitectOutput;
              ctx.structuredArchitecture = data;
              displayOutput = formatArchitectOutput(data, rawOutput);
              break;
            }
            case "critic": {
              const data = structuredResult.data as CriticOutput;
              ctx.structuredCritique = data;
              displayOutput = formatCritiqueOutput(data, rawOutput);
              break;
            }
            case "final_agent": {
              const data = structuredResult.data as FinalOutput;
              ctx.structuredFinal = data;
              displayOutput = rawOutput; // Final agent uses its own formatter
              break;
            }
          }

          console.log(
            `[Orchestrator] ${stepId} -> VALIDATED (mode: ${structuredResult.mode}, retries: ${structuredResult.retriesUsed})`
          );
        } else {
          console.warn(
            `[Orchestrator] ${stepId} -> VALIDATION FAILED after ${structuredResult.retriesUsed} retries. Using raw output.`
          );
          // Still use raw output for context — downstream agents need it
        }
      }

      // Update context based on step output
      switch (stepId) {
        case "planner":
          ctx.plan = rawOutput;
          break;
        case "researcher":
          ctx.researchOutput = rawOutput;
          break;
        case "risk_agent":
          ctx.riskOutput = rawOutput;
          break;
        case "architect":
          ctx.architectureOutput = rawOutput;
          break;
        case "critic":
          ctx.critiqueOutput = rawOutput;
          break;
      }

      steps.push(
        createCompletedStep(
          stepId,
          stepConfig.label,
          task,
          displayOutput,
          stepConfig.model,
          modelDisplayName,
          stepConfig.model,
          validationResult
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
        modelId: stepConfig.model,
      });

      // If a non-optional step fails, we still continue with fallback data
      // The final agent will generate a fallback report if needed
    }
  }

  // -- Post-pipeline: Storage, Memory, On-chain --

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
    console.log(`[Orchestrator]   On-chain tx SUCCESS: ${onChainResult.txHash} (block ${onChainResult.blockNumber})`);
  } else {
    console.warn("[Orchestrator]   On-chain registration SKIPPED -- check .env configuration");
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

  // Add structured output validation summary
  const validatedSteps = steps.filter((s) => s.validation?.validated);
  const failedValidationSteps = steps.filter((s) => s.validation && !s.validation.validated);
  memoryWriterLines.push(
    `Structured output: ${validatedSteps.length} validated, ${failedValidationSteps.length} fallback.`
  );

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
      memoryWriterConfig?.model ?? "deepseek/deepseek-chat-v3-0324",
      {
        validated: true,
        retriesUsed: 0,
        mode: "NO_SCHEMA" as ValidationMode,
        finalModel: memoryWriterConfig?.model ?? "deepseek/deepseek-chat-v3-0324",
        errors: [],
      }
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
