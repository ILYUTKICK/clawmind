import { runArchitectAgent } from "@/lib/agents/architect";
import { runCriticAgent } from "@/lib/agents/critic";
import { runFinalAgent } from "@/lib/agents/final-agent";
import { runPlannerAgent } from "@/lib/agents/planner";
import { runResearchAgent } from "@/lib/agents/researcher";
import { runRiskAgent } from "@/lib/agents/risk-agent";
import { getComputeProviderLabel } from "@/lib/compute/compute-status";
import { saveMemoryIndexToZeroGStorage } from "@/lib/storage/zero-g-memory-index";
import {
  formatMemoryContext,
  getRelevantMemories,
  saveGeneratedMemoryRecord,
} from "@/lib/memory/memory-manager";
import { saveAnalysisReceipt } from "@/lib/storage/storage-receipt";
import { AgentName, AgentStep, AnalysisResult } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

function createCompletedStep(
  name: AgentName,
  label: string,
  input: string,
  output: string
): AgentStep {
  const timestamp = nowIso();

  return {
    name,
    label,
    status: "completed",
    input,
    output,
    startedAt: timestamp,
    finishedAt: timestamp,
  };
}

export async function runAnalysis(task: string): Promise<AnalysisResult> {
  const steps: AgentStep[] = [];
  const computeProvider = getComputeProviderLabel();

  const relevantMemories = await getRelevantMemories(task);
  const memoryContext = formatMemoryContext(relevantMemories);

  steps.push(
    createCompletedStep(
      "memory_retrieval",
      "Memory Retrieval",
      task,
      `Found ${relevantMemories.length} relevant memory record(s).\n${memoryContext}`
    )
  );

  const plan = await runPlannerAgent(task, memoryContext);

  steps.push(createCompletedStep("planner", "Planner Agent", task, plan));

  const researchOutput = await runResearchAgent(task, plan);

  steps.push(
    createCompletedStep("researcher", "Research Agent", task, researchOutput)
  );

  const riskOutput = await runRiskAgent(task, researchOutput, memoryContext);

  steps.push(createCompletedStep("risk_agent", "Risk Agent", task, riskOutput));

  const architectureOutput = await runArchitectAgent(
    task,
    researchOutput,
    riskOutput
  );

  steps.push(
    createCompletedStep("architect", "Architect Agent", task, architectureOutput)
  );

  const critiqueOutput = await runCriticAgent(
    task,
    plan,
    researchOutput,
    riskOutput,
    architectureOutput
  );

  steps.push(createCompletedStep("critic", "Critic Agent", task, critiqueOutput));

  const finalResult = await runFinalAgent({
    task,
    memories: relevantMemories,
    plan,
    researchOutput,
    riskOutput,
    architectureOutput,
    critiqueOutput,
  });

  steps.push(
    createCompletedStep(
      "final_agent",
      "Final Decision Agent",
      task,
      finalResult.rawOutput
    )
  );

  const receipt = await saveAnalysisReceipt({
  task,
  report: finalResult.report,
});

const generatedMemoryResult = await saveGeneratedMemoryRecord({
  task,
  report: finalResult.report,
  storageUri: receipt.storageUri,
});

const memoryIndexReceipt = await saveMemoryIndexToZeroGStorage({
  memories: generatedMemoryResult.memories,
});

steps.push(
  createCompletedStep(
    "memory_writer",
    "Memory Writer",
    JSON.stringify({
      report: finalResult.report,
      memory: generatedMemoryResult.memory,
      memoryIndexReceipt,
    }),
    [
      `Saved analysis through ${receipt.provider}.`,
      `Compute provider: ${computeProvider}.`,
      `Receipt: ${receipt.reportHash}.`,
      `Generated persistent memory: ${generatedMemoryResult.memory.id}.`,
      `Memory index provider: ${memoryIndexReceipt.provider}.`,
      `Memory index URI: ${memoryIndexReceipt.storageUri}.`,
    ].join(" ")
  )
);

  return {
    task,
    steps,
    relevantMemories,
    report: finalResult.report,
    receipt,
    memoryIndexReceipt,
  };
}