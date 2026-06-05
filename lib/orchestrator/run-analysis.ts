import { runArchitectAgent } from "@/lib/agents/architect";
import { runCriticAgent } from "@/lib/agents/critic";
import { runFinalAgent } from "@/lib/agents/final-agent";
import { runPlannerAgent } from "@/lib/agents/planner";
import { runResearchAgent } from "@/lib/agents/researcher";
import { runRiskAgent } from "@/lib/agents/risk-agent";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { getModelForAgent } from "@/lib/compute/model-router";
import { formatMemoryContext, getRelevantMemories, saveGeneratedMemoryRecord } from "@/lib/memory/memory-manager";
import { rememberLatestMemoryIndexUri } from "@/lib/memory/persistent-memory-store";
import { saveAnalysisReceipt } from "@/lib/storage/storage-receipt";
import { saveMemoryIndexToZeroGStorage } from "@/lib/storage/zero-g-memory-index";
import { recordAnalysisOnChain, buildOnChainReceipt } from "@/lib/contracts/analysis-registry";
import { recordAnalysisMetric } from "@/lib/metrics/analysis-metrics";
import { AgentName, AgentProvider, AgentStep, AnalysisResult, AnalysisSource } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDurationFromStep(step: AgentStep, finishedAt: string): number | undefined {
  if (!step.startedAt) {
    return undefined;
  }

  const startedMs = Date.parse(step.startedAt);
  const finishedMs = Date.parse(finishedAt);

  if (!Number.isFinite(startedMs) || !Number.isFinite(finishedMs)) {
    return undefined;
  }

  return Math.max(0, finishedMs - startedMs);
}

function getCostStatus(provider?: AgentProvider): AgentStep["costStatus"] {
  return provider === "LOCAL_EMBEDDINGS" || provider === "LOCAL_FALLBACK" || provider === "NOT_CONFIGURED"
    ? "not_applicable"
    : "not_reported";
}

async function timeOperation<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const startedAt = Date.now();

  try {
    const result = await operation();
    const durationMs = Date.now() - startedAt;
    console.log(`[Orchestrator] ${label} completed in ${formatDuration(durationMs)}`);
    return { result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.warn(
      `[Orchestrator] ${label} failed after ${formatDuration(durationMs)}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    throw error;
  }
}

function createRunningStep(name: AgentName, label: string, input: string): AgentStep {
  const modelConfig = getModelForAgent(name);
  const provider = getComputeProviderLabel();

  return {
    name,
    label,
    status: "running",
    input,
    inputChars: input.length,
    model: modelConfig.model,
    modelFamily: "0G Compute",
    provider,
    costStatus: getCostStatus(provider),
    startedAt: nowIso(),
  };
}

function completeStep(step: AgentStep, output: string, durationMs?: number): AgentStep {
  const finishedAt = nowIso();

  return {
    ...step,
    status: "completed",
    output,
    outputChars: output.length,
    durationMs: durationMs ?? getDurationFromStep(step, finishedAt),
    finishedAt,
  };
}

function failStep(step: AgentStep, error: string): AgentStep {
  const finishedAt = nowIso();

  return {
    ...step,
    status: "failed",
    error,
    durationMs: getDurationFromStep(step, finishedAt),
    finishedAt,
  };
}

// Progress callback type — called after each pipeline step
export type ProgressCallback = (currentStep: string, steps: AgentStep[]) => void | Promise<void>;
type RunAnalysisOptions = {
  taskId?: string;
  source?: AnalysisSource;
};

export async function runAnalysis(
  task: string,
  onProgress?: ProgressCallback,
  options: RunAnalysisOptions = {},
): Promise<AnalysisResult> {
  const steps: AgentStep[] = [];
  const source = options.source ?? "web";

  // Helper to push a step and notify progress
  async function pushStep(step: AgentStep, currentStep: string) {
    steps.push(step);
    await onProgress?.(currentStep, [...steps]);
  }

  // Helper to update an existing step in-place (for parallel completion)
  async function updateStep(index: number, updatedStep: AgentStep, currentStep: string) {
    steps[index] = updatedStep;
    await onProgress?.(currentStep, [...steps]);
  }

  // ============================================================
  // Step 1: Memory Retrieval
  // ============================================================
  const memoryStart = nowIso();
  const { result: relevantMemories, durationMs: memoryRetrievalDurationMs } =
    await timeOperation("Memory retrieval", () => getRelevantMemories(task));
  const memoryContext = formatMemoryContext(relevantMemories);

  const memoryRetrievalOutput = [
    `Found ${relevantMemories.length} relevant memory record(s).`,
    `Completed in ${formatDuration(memoryRetrievalDurationMs)}.`,
    "Memory source: local cache + 0G Storage memory index when available.",
    memoryContext,
  ].join("\n");

  await pushStep({
    name: "memory_retrieval",
    label: "Memory Retrieval",
    status: "completed",
    input: task,
    inputChars: task.length,
    model: "all-MiniLM-L6-v2",
    modelFamily: "Local embeddings",
    provider: "LOCAL_EMBEDDINGS",
    costStatus: "not_applicable",
    output: memoryRetrievalOutput,
    outputChars: memoryRetrievalOutput.length,
    durationMs: memoryRetrievalDurationMs,
    startedAt: memoryStart,
    finishedAt: nowIso(),
  }, "planner");

  // ============================================================
  // Step 2: Planner Agent
  // ============================================================
  const plannerStep = createRunningStep("planner", "Planner Agent", task);
  const plannerIdx = steps.length;
  await pushStep(plannerStep, "planner");

  const { result: plan, durationMs: plannerDurationMs } = await timeOperation("Planner Agent", () =>
    runPlannerAgent(task, memoryContext),
  );
  await updateStep(plannerIdx, completeStep(plannerStep, plan, plannerDurationMs), "researcher");

  // ============================================================
  // Step 3: Research Agent
  // ============================================================
  const researcherStep = createRunningStep("researcher", "Research Agent", task);
  const researcherIdx = steps.length;
  await pushStep(researcherStep, "researcher");

  const { result: researchOutput, durationMs: researcherDurationMs } = await timeOperation("Research Agent", () =>
    runResearchAgent(task, plan),
  );
  await updateStep(researcherIdx, completeStep(researcherStep, researchOutput, researcherDurationMs), "risk_agent+architect");

  // ============================================================
  // Steps 4+5: Risk Agent + Architect Agent IN PARALLEL
  // ============================================================
  const riskStep = createRunningStep("risk_agent", "Risk Agent", task);
  const riskIdx = steps.length;
  await pushStep(riskStep, "risk_agent+architect");

  const architectStep = createRunningStep("architect", "Architect Agent", task);
  const architectIdx = steps.length;
  await pushStep(architectStep, "risk_agent+architect");

  const [riskResult, architectResult] = await Promise.all([
    timeOperation("Risk Agent", () => runRiskAgent(task, researchOutput, memoryContext))
      .then((output) => ({ output, durationMs: output.durationMs, error: null as string | null }))
      .catch((err) => ({
        output: null,
        durationMs: undefined,
        error: err instanceof Error ? err.message : "Risk agent failed",
      })),

    timeOperation("Architect Agent", () => runArchitectAgent(task, researchOutput, ""))
      .then((output) => ({ output, durationMs: output.durationMs, error: null as string | null }))
      .catch((err) => ({
        output: null,
        durationMs: undefined,
        error: err instanceof Error ? err.message : "Architect agent failed",
      })),
  ]);

  if (riskResult.output) {
    await updateStep(riskIdx, completeStep(riskStep, riskResult.output.result, riskResult.durationMs), "critic");
  } else {
    await updateStep(riskIdx, failStep(riskStep, riskResult.error ?? "Unknown error"), "critic");
  }

  const riskOutput = riskResult.output?.result ?? "Risk analysis unavailable — using fallback risk assessment.";

  if (architectResult.output) {
    await updateStep(architectIdx, completeStep(architectStep, architectResult.output.result, architectResult.durationMs), "critic");
  } else {
    await updateStep(architectIdx, failStep(architectStep, architectResult.error ?? "Unknown error"), "critic");
  }

  const architectureOutput = architectResult.output?.result ?? "Architecture proposal unavailable — using fallback architecture.";

  // ============================================================
  // Step 6: Critic Agent
  // ============================================================
  const criticStep = createRunningStep("critic", "Critic Agent", task);
  const criticIdx = steps.length;
  await pushStep(criticStep, "critic");

  const { result: critiqueOutput, durationMs: criticDurationMs } = await timeOperation("Critic Agent", () =>
    runCriticAgent(task, plan, researchOutput, riskOutput, architectureOutput),
  );
  await updateStep(criticIdx, completeStep(criticStep, JSON.stringify(critiqueOutput), criticDurationMs), "final_agent");

  // ============================================================
  // Step 7: Final Decision Agent
  // ============================================================
  const finalStep = createRunningStep("final_agent", "Final Decision Agent", task);
  const finalIdx = steps.length;
  await pushStep(finalStep, "final_agent");

  const { result: finalResult, durationMs: finalDurationMs } = await timeOperation("Final Decision Agent", () =>
    runFinalAgent({
      task,
      memories: relevantMemories,
      plan,
      researchOutput,
      riskOutput,
      architectureOutput,
      critiqueOutput,
    }),
  );

  await updateStep(finalIdx, completeStep(finalStep, finalResult.rawOutput, finalDurationMs), "report_storage");

  // ============================================================
  // Step 8: Persist report to 0G Storage
  // ============================================================
  const reportStorageStep: AgentStep = {
    ...createRunningStep(
      "report_storage",
      "Report Storage",
      JSON.stringify(finalResult.report),
    ),
    model: "0G Storage",
    modelFamily: "0G Storage",
    provider: "0G_STORAGE",
    costStatus: "not_reported",
  };
  const reportStorageIdx = steps.length;
  await pushStep(reportStorageStep, "report_storage");

  const { result: receipt, durationMs: reportStorageDurationMs } =
    await timeOperation("Report storage", () =>
      saveAnalysisReceipt({
        task,
        report: finalResult.report,
      }),
    );

  await updateStep(
    reportStorageIdx,
    {
      ...completeStep(
        reportStorageStep,
        [
          `Saved report through ${receipt.provider} in ${formatDuration(reportStorageDurationMs)}.`,
          `Report hash: ${receipt.reportHash}.`,
          `Report URI: ${receipt.storageUri ?? "not available"}.`,
        ].join(" "),
        reportStorageDurationMs,
      ),
      provider: receipt.provider,
      costStatus: getCostStatus(receipt.provider),
    },
    "memory_index+onchain_registry",
  );

  const hasVerifiableReportStorage =
    receipt.provider === "0G_STORAGE" && receipt.storageUri?.startsWith("0g://");

  // ============================================================
  // Steps 9+10: prepare memory and register on-chain concurrently
  // ============================================================
  const memoryIndexStep: AgentStep = {
    ...createRunningStep("memory_index", "Memory Index", task),
    model: "all-MiniLM-L6-v2 + 0G Storage",
    modelFamily: "Local embeddings + 0G Storage",
    provider: "0G_STORAGE",
    costStatus: "not_reported",
  };
  const memoryIndexIdx = steps.length;
  await pushStep(memoryIndexStep, "memory_index+onchain_registry");

  const onChainStep: AgentStep = {
    ...createRunningStep(
      "onchain_registry",
      "On-chain Registry",
      receipt.reportHash,
    ),
    model: "EIP-712 operator signature",
    modelFamily: "0G Chain",
    provider: "0G_CHAIN",
    costStatus: "not_reported",
  };
  const onChainIdx = steps.length;
  await pushStep(onChainStep, "memory_index+onchain_registry");

  console.log("[Orchestrator] Step 10: On-chain registration attempt...");
  console.log(`[Orchestrator]   Network: ${process.env.ZERO_G_NETWORK ?? "testnet (default)"}`);
  console.log(`[Orchestrator]   Contract: ${process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS ?? "NOT SET"}`);
  console.log(`[Orchestrator]   Private key: ${process.env.ZERO_G_STORAGE_PRIVATE_KEY ? "SET" : "NOT SET"}`);
  console.log(`[Orchestrator]   Storage enabled: ${process.env.ZERO_G_STORAGE_ENABLED ?? "not set"}`);

  const memoryPreparationPromise = timeOperation("Memory record preparation", () =>
    saveGeneratedMemoryRecord({
      task,
      report: finalResult.report,
      storageUri: receipt.storageUri,
    }),
  );

  const onChainReceiptPromise = (async () => {
    const { result: onChainResult, durationMs: onChainDurationMs } =
      await timeOperation("On-chain registry", async () => {
        if (!hasVerifiableReportStorage) {
          console.warn(
            `[Orchestrator]   ✗ On-chain registration SKIPPED — report storage provider is ${receipt.provider}, uri=${receipt.storageUri ?? "not available"}`
          );
          console.warn("[Orchestrator]   Only 0g:// report receipts are anchored on-chain.");
          return null;
        }

        return recordAnalysisOnChain({
          task,
          rootHash: receipt.reportHash,
          storageUri: receipt.storageUri ?? "",
          score: finalResult.report.score,
          recommendation: finalResult.report.recommendation,
        });
      });

    if (onChainResult) {
      console.log(`[Orchestrator]   ✓ On-chain tx SUCCESS: ${onChainResult.txHash} (block ${onChainResult.blockNumber})`);
    } else if (hasVerifiableReportStorage) {
      console.warn("[Orchestrator]   ✗ On-chain registration SKIPPED — check .env configuration");
      console.warn("[Orchestrator]   Required: ZERO_G_NETWORK=mainnet, ZERO_G_STORAGE_PRIVATE_KEY=<real key>, ZERO_G_ANALYSIS_REGISTRY_ADDRESS=<contract>");
    }

    const onChainReceipt = buildOnChainReceipt(
      onChainResult,
      process.env.ZERO_G_ANALYSIS_REGISTRY_ADDRESS,
    );
    const onChainLines = [
      `On-chain registry finished in ${formatDuration(onChainDurationMs)}.`,
      `Provider: ${onChainReceipt.provider}.`,
    ];

    if (onChainReceipt.provider === "0G_CHAIN") {
      onChainLines.push(
        `Analysis ID: ${onChainReceipt.analysisId}.`,
        `Tx: ${onChainReceipt.explorerTxUrl || onChainReceipt.txHash}.`,
        `Contract: ${onChainReceipt.contractAddress}.`,
        `Registry mode: ${onChainReceipt.registryMode ?? "UNKNOWN"}.`,
      );

      if (onChainReceipt.signatureVerified && onChainReceipt.signedBy) {
        onChainLines.push(
          `Signed by authorized operator: ${onChainReceipt.signedBy}.`,
          `Task hash: ${onChainReceipt.taskHash}.`,
        );
      }
    } else if (!hasVerifiableReportStorage) {
      onChainLines.push(
        "Skipped because the report was not persisted to a verifiable 0g:// storage URI.",
      );
    }

    await updateStep(
      onChainIdx,
      {
        ...completeStep(onChainStep, onChainLines.join(" "), onChainDurationMs),
        provider: onChainReceipt.provider,
        costStatus: getCostStatus(onChainReceipt.provider),
      },
      "memory_index",
    );

    return onChainReceipt;
  })();

  const [
    { result: generatedMemoryResult, durationMs: memoryPreparationDurationMs },
    onChainReceipt,
  ] = await Promise.all([memoryPreparationPromise, onChainReceiptPromise]);

  const { result: memoryIndexReceipt, durationMs: memoryIndexDurationMs } =
    await timeOperation("Memory index upload", () =>
      saveMemoryIndexToZeroGStorage({
        memories: generatedMemoryResult.memories,
      }),
    );

  await rememberLatestMemoryIndexUri(memoryIndexReceipt.storageUri);

  await updateStep(
    memoryIndexIdx,
    {
      ...completeStep(
        memoryIndexStep,
        [
          `Generated persistent memory ${generatedMemoryResult.memory.id} in ${formatDuration(memoryPreparationDurationMs)}.`,
          `Memory index saved through ${memoryIndexReceipt.provider} in ${formatDuration(memoryIndexDurationMs)}.`,
          `Memory index hash: ${memoryIndexReceipt.reportHash}.`,
          `Memory index URI: ${memoryIndexReceipt.storageUri ?? "not available"}.`,
          "If the memory index URI starts with 0g://, later runs can load it through ZERO_G_MEMORY_INDEX_URI or the local latest-memory-index-uri.txt pointer.",
        ].join(" "),
      ),
      provider: memoryIndexReceipt.provider,
      costStatus: getCostStatus(memoryIndexReceipt.provider),
    },
    "completed",
  );

  const analysisResult: AnalysisResult = {
    task,
    steps,
    relevantMemories,
    report: finalResult.report,
    receipt,
    memoryIndexReceipt,
    onChainReceipt,
  };

  if (options.taskId) {
    try {
      await recordAnalysisMetric(options.taskId, source, analysisResult);
    } catch (error) {
      console.warn(
        `[Metrics] Failed to record analysis metric: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  return analysisResult;
}
