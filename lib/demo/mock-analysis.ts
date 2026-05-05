import {
  AgentStep,
  AnalysisReport,
  AnalysisResult,
  MemoryRecord,
  StorageReceipt,
} from "@/lib/types";
import { findRelevantMockMemories } from "@/lib/demo/mock-memory";

function nowIso(): string {
  return new Date().toISOString();
}

function createHashLikeValue(input: string): string {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash |= 0;
  }

  const positiveHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${positiveHash}${positiveHash}${positiveHash}${positiveHash}`;
}

function createCompletedStep(
  name: AgentStep["name"],
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

function buildReport(task: string, memories: MemoryRecord[]): AnalysisReport {
  const memoryRiskHints = memories.flatMap((memory) => memory.risks);

  const uniqueMemoryRiskHints = Array.from(new Set(memoryRiskHints)).slice(0, 3);

  return {
    summary:
      "The project has strong potential as a Web3 AI decision system, but it becomes high-risk if autonomous agents can directly influence user funds, protocol execution, or security-sensitive actions.",
    score: 72,
    recommendation: "INVESTIGATE_MORE",
    risks: [
      {
        title: "Autonomous execution risk",
        severity: "high",
        explanation:
          "If an AI agent can trigger transactions or operational decisions without strict constraints, a wrong model output may create real financial or security damage.",
      },
      {
        title: "Custody and permission risk",
        severity: "critical",
        explanation:
          "Any workflow involving user funds, delegated wallets, or signing permissions must separate reasoning from execution and enforce hard policy limits.",
      },
      {
        title: "Oracle and external data risk",
        severity: "high",
        explanation:
          "The agent may depend on APY, price, liquidity, or protocol health data that can be stale, manipulated, or incomplete.",
      },
      {
        title: "Memory poisoning risk",
        severity: "medium",
        explanation:
          "Persistent agent memory improves long-context reasoning, but malicious or low-quality memories can bias future decisions.",
      },
    ],
    opportunities: [
      "Persistent memory lets the agent reuse previous risk patterns instead of starting from zero.",
      "0G Compute can act as the inference layer for modular agent calls.",
      "0G Storage can store reports, agent logs, and long-term memory records.",
      "A verifiable decision receipt can make AI-generated reports easier to audit.",
      ...uniqueMemoryRiskHints.map(
        (risk) => `Previous memory suggests prioritizing: ${risk}.`
      ),
    ],
    architecture: [
      "Use a multi-agent pipeline: Memory Retrieval → Planner → Researcher → Risk Agent → Architect → Critic → Final Agent.",
      "Use 0G Compute as the LLM inference backend for each agent node.",
      "Use 0G Storage to persist final reports, pipeline logs, and memory summaries.",
      "Keep execution permissions outside the LLM and enforce deterministic policy checks.",
      "Generate a report hash and storage reference for every analysis result.",
    ],
    nextSteps: [
      "Replace mock inference with real 0G Compute calls.",
      "Replace local mock memory with 0G Storage-backed memory records.",
      "Add document upload or URL analysis for whitepapers, GitHub READMEs, and protocol docs.",
      "Add memory ranking with embeddings or semantic similarity.",
      "Add a second demo run that visibly reuses previous risk memories.",
    ],
    evidence: [
      `User task: ${task}`,
      `Relevant memories used: ${memories.length}`,
      "Pipeline completed with planner, researcher, risk, architect, critic, and final decision agents.",
      "Storage receipt generated using local fallback provider for MVP demo.",
    ],
  };
}

export function createMockAnalysis(task: string): AnalysisResult {
  const relevantMemories = findRelevantMockMemories(task);

  const memorySummary =
    relevantMemories.length > 0
      ? relevantMemories
          .map((memory) => `${memory.task}: ${memory.risks.join(", ")}`)
          .join("\n")
      : "No relevant memories found.";

  const steps: AgentStep[] = [
    createCompletedStep(
      "memory_retrieval",
      "Memory Retrieval",
      task,
      `Found ${relevantMemories.length} relevant memory record(s).\n${memorySummary}`
    ),
    createCompletedStep(
      "planner",
      "Planner Agent",
      task,
      "Plan: identify product goal, extract technical assumptions, analyze risks, propose architecture, critique weak points, and generate a final recommendation."
    ),
    createCompletedStep(
      "researcher",
      "Research Agent",
      task,
      "Extracted facts: the system is Web3/AI-oriented, requires multi-step reasoning, benefits from persistent memory, and may involve security-sensitive decisions."
    ),
    createCompletedStep(
      "risk_agent",
      "Risk Agent",
      task,
      "Detected risks: autonomous execution, custody and permissions, oracle dependency, memory poisoning, and overconfident recommendations."
    ),
    createCompletedStep(
      "architect",
      "Architect Agent",
      task,
      "Suggested architecture: modular agent pipeline, 0G Compute inference layer, 0G Storage memory layer, deterministic policy checks, and verifiable receipts."
    ),
    createCompletedStep(
      "critic",
      "Critic Agent",
      task,
      "Critique: the project must avoid looking like a simple chatbot. The demo should clearly show memory reuse, orchestration, and storage-backed provenance."
    ),
    createCompletedStep(
      "final_agent",
      "Final Decision Agent",
      task,
      "Final decision: investigate more. The idea is promising, but direct autonomous execution must be constrained and audited."
    ),
  ];

  const report = buildReport(task, relevantMemories);

  const receipt: StorageReceipt = {
    reportHash: createHashLikeValue(JSON.stringify({ task, report })),
    storageUri: `local://clawmind/reports/${Date.now()}`,
    provider: "LOCAL_FALLBACK",
    createdAt: nowIso(),
  };

  steps.push(
    createCompletedStep(
      "memory_writer",
      "Memory Writer",
      JSON.stringify(report),
      `Saved report through ${receipt.provider}. Receipt: ${receipt.reportHash}`
    )
  );

  return {
    task,
    steps,
    relevantMemories,
    report,
    receipt,
  };
}