import { runArchitectAgent } from "@/lib/agents/architect";
import { runCriticAgent } from "@/lib/agents/critic";
import { runFinalAgent } from "@/lib/agents/final-agent";
import { runPlannerAgent } from "@/lib/agents/planner";
import { runResearchAgent } from "@/lib/agents/researcher";
import { runRiskAgent } from "@/lib/agents/risk-agent";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { formatMemoryContext, getRelevantMemories, saveGeneratedMemoryRecord } from "@/lib/memory/memory-manager";
import { rememberLatestMemoryIndexUri } from "@/lib/memory/persistent-memory-store";
import { saveAnalysisReceipt } from "@/lib/storage/storage-receipt";
import { saveMemoryIndexToZeroGStorage } from "@/lib/storage/zero-g-memory-index";
import { recordAnalysisOnChain, buildOnChainReceipt } from "@/lib/contracts/analysis-registry";
import { AgentName, AgentStep, AnalysisResult } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

function createRunningStep(name: AgentName, label: string, input: string): AgentStep {
  return {
    name,
    label,
    status: "running",
    input,
    startedAt: nowIso(),
  };
}

function completeStep(step: AgentStep, output: string): AgentStep {
  return {
    ...step,
    status: "completed",
    output,
    finishedAt: nowIso(),
  };
}

function failStep(step: AgentStep, error: string): AgentStep {
  return {
    ...step,
    status: "failed",
    error,
    finishedAt: nowIso(),
  };
}

// Progress callback type — called after each pipeline step
export type ProgressCallback = (currentStep: string, steps: AgentStep[]) => void | Promise<void>;

export async function runAnalysis(
  task: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const steps: AgentStep[] = [];
  const computeProvider = getComputeProviderLabel();

  // Helper to push a step and notify progress
  function pushStep(step: AgentStep, currentStep: string) {
    steps.push(step);
    onProgress?.(currentStep, [...steps]);
  }

  // Helper to update an existing step in-place (for parallel completion)
  function updateStep(index: number, updatedStep: AgentStep, currentStep: string) {
    steps[index] = updatedStep;
    onProgress?.(currentStep, [...steps]);
  }

  // ============================================================
  // Step 1: Memory Retrieval
  // ============================================================
  const memoryStart = nowIso();
  const relevantMemories = await getRelevantMemories(task);
  const memoryContext = formatMemoryContext(relevantMemories);

  pushStep({
    name: "memory_retrieval",
    label: "Memory Retrieval",
    status: "completed",
    input: task,
    output: [
      `Found ${relevantMemories.length} relevant memory record(s).`,
      "Memory source: local cache + 0G Storage memory index when available.",
      memoryContext,
    ].join("\n"),
    startedAt: memoryStart,
    finishedAt: nowIso(),
  }, "planner");

  // ============================================================
  // Step 2: Planner Agent
  // ============================================================
  const plannerStep = createRunningStep("planner", "Planner Agent", task);
  const plannerIdx = steps.length;
  pushStep(plannerStep, "planner");

  const plan = await runPlannerAgent(task, memoryContext);
  updateStep(plannerIdx, completeStep(plannerStep, plan), "researcher");

  // ============================================================
  // Step 3: Research Agent
  // ============================================================
  const researcherStep = createRunningStep("researcher", "Research Agent", task);
  const researcherIdx = steps.length;
  pushStep(researcherStep, "researcher");

  const researchOutput = await runResearchAgent(task, plan);
  updateStep(researcherIdx, completeStep(researcherStep, researchOutput), "risk_agent+architect");

  // ============================================================
  // Steps 4+5: Risk Agent + Architect Agent IN PARALLEL
  // ============================================================
  const riskStep = createRunningStep("risk_agent", "Risk Agent", task);
  const riskIdx = steps.length;
  pushStep(riskStep, "risk_agent+architect");

  const architectStep = createRunningStep("architect", "Architect Agent", task);
  const architectIdx = steps.length;
  pushStep(architectStep, "risk_agent+architect");

  const [riskResult, architectResult] = await Promise.all([
    runRiskAgent(task, researchOutput, memoryContext)
      .then((output) => ({ output, error: null as string | null }))
      .catch((err) => ({ output: null, error: err instanceof Error ? err.message : "Risk agent failed" })),

    runArchitectAgent(task, researchOutput, "")
      .then((output) => ({ output, error: null as string | null }))
      .catch((err) => ({ output: null, error: err instanceof Error ? err.message : "Architect agent failed" })),
  ]);

  if (riskResult.output) {
    updateStep(riskIdx, completeStep(riskStep, riskResult.output), "critic");
  } else {
    updateStep(riskIdx, failStep(riskStep, riskResult.error ?? "Unknown error"), "critic");
  }

  const riskOutput = riskResult.output ?? "Risk analysis unavailable — using fallback risk assessment.";

  if (architectResult.output) {
    updateStep(architectIdx, completeStep(architectStep, architectResult.output), "critic");
  } else {
    updateStep(architectIdx, failStep(architectStep, architectResult.error ?? "Unknown error"), "critic");
  }

  const architectureOutput = architectResult.output ?? "Architecture proposal unavailable — using fallback architecture.";

  // ============================================================
  // Step 6: Critic Agent
  // ============================================================
  const criticStep = createRunningStep("critic", "Critic Agent", task);
  const criticIdx = steps.length;
  pushStep(criticStep, "critic");

  const critiqueOutput = await runCriticAgent(task, plan, researchOutput, riskOutput, architectureOutput);
  updateStep(criticIdx, completeStep(criticStep, JSON.stringify(critiqueOutput)), "final_agent");

  // ============================================================
  // Step 7: Final Decision Agent
  // ============================================================
  const finalStep = createRunningStep("final_agent", "Final Decision Agent", task);
  const finalIdx = steps.length;
  pushStep(finalStep, "final_agent");

  const finalResult = await runFinalAgent({
    task,
    memories: relevantMemories,
    plan,
    researchOutput,
    riskOutput,
    architectureOutput,
    critiqueOutput,
  });

  updateStep(finalIdx, completeStep(finalStep, finalResult.rawOutput), "memory_writer");

  // ============================================================
  // Step 8: Persist report to 0G Storage
  // ============================================================
  const receipt = await saveAnalysisReceipt({
    task,
    report: finalResult.report,
  });

  // Step 9: Generate and persist memory record + memory index
  const generatedMemoryResult = await saveGeneratedMemoryRecord({
    task,
    report: finalResult.report,
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
  console.log(`[Orchestrator]   Private key: ${process.env.ZERO_G_STORAGE_PRIVATE_KEY ? "SET (" + process.env.ZERO_G_STORAGE_PRIVATE_KEY.slice(0, 6) + "...)" : "NOT SET"}`);
  console.log(`[Orchestrator]   Storage enabled: ${process.env.ZERO_G_STORAGE_ENABLED ?? "not set"}`);

  const onChainResult = await recordAnalysisOnChain({
    task,
    rootHash: receipt.reportHash,
    storageUri: receipt.storageUri ?? "",
    score: finalResult.report.score,
    recommendation: finalResult.report.recommendation,
  });

  if (onChainResult) {
    console.log(`[Orchestrator]   ✓ On-chain tx SUCCESS: ${onChainResult.txHash} (block ${onChainResult.blockNumber})`);
  } else {
    console.warn("[Orchestrator]   ✗ On-chain registration SKIPPED — check .env configuration");
    console.warn("[Orchestrator]   Required: ZERO_G_NETWORK=mainnet, ZERO_G_STORAGE_PRIVATE_KEY=<real key>, ZERO_G_ANALYSIS_REGISTRY_ADDRESS=<contract>");
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
    `Memory index URI: ${memoryIndexReceipt.storageUri ?? "not available"}.`,
    `On-chain registry: ${onChainReceipt.provider}.`,
  ];

  if (onChainReceipt.provider === "0G_CHAIN") {
    memoryWriterLines.push(
      `On-chain analysis ID: ${onChainReceipt.analysisId}.`,
      `On-chain tx: ${onChainReceipt.explorerTxUrl || onChainReceipt.txHash}.`,
      `Contract: ${onChainReceipt.contractAddress}.`,
      `Registry mode: ${onChainReceipt.registryMode ?? "UNKNOWN"}.`
    );

    if (onChainReceipt.signatureVerified && onChainReceipt.signedBy) {
      memoryWriterLines.push(
        `Signed by authorized operator: ${onChainReceipt.signedBy}.`,
        `Task hash: ${onChainReceipt.taskHash}.`
      );
    }
  }

  memoryWriterLines.push(
    "If the memory index URI starts with 0g://, later runs can load it through ZERO_G_MEMORY_INDEX_URI or the local latest-memory-index-uri.txt pointer."
  );

  pushStep(
    {
      name: "memory_writer",
      label: "Memory Writer",
      status: "completed",
      input: JSON.stringify(
        {
          report: finalResult.report,
          memory: generatedMemoryResult.memory,
          memoryIndexReceipt,
          onChainReceipt,
        },
        null,
        2,
      ),
      output: memoryWriterLines.join(" "),
      startedAt: nowIso(),
      finishedAt: nowIso(),
    },
    "completed"
  );

  return {
    task,
    steps,
    relevantMemories,
    report: finalResult.report,
    receipt,
    memoryIndexReceipt,
    onChainReceipt,
  };
}
