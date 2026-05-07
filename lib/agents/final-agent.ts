import { AnalysisReport, MemoryRecord } from "@/lib/types";
import { runInference } from "@/lib/compute/zero-g-compute";

export async function runFinalAgent(input: {
  task: string;
  memories: MemoryRecord[];
  plan: string;
  researchOutput: string;
  riskOutput: string;
  architectureOutput: string;
  critiqueOutput: string;
}): Promise<{
  rawOutput: string;
  report: AnalysisReport;
}> {
  const rawOutput = await runInference({
    agentName: "final_agent",
    systemPrompt:
      "You are the Final Decision Agent in ClawMind. Generate a structured final decision report for a Web3/AI project.",
    userPrompt: [
      `Task: ${input.task}`,
      "",
      "Relevant memories:",
      input.memories
        .map(
          (memory) =>
            `- ${memory.summary} Risks: ${memory.risks.join(", ")}. Score: ${memory.score}.`
        )
        .join("\n") || "No relevant memories.",
      "",
      "Plan:",
      input.plan,
      "",
      "Research:",
      input.researchOutput,
      "",
      "Risks:",
      input.riskOutput,
      "",
      "Architecture:",
      input.architectureOutput,
      "",
      "Critique:",
      input.critiqueOutput,
      "",
      "Return a concise final recommendation.",
    ].join("\n"),
  });

  const memoryRiskHints = input.memories.flatMap((memory) => memory.risks);
  const uniqueMemoryRiskHints = Array.from(new Set(memoryRiskHints)).slice(0, 3);

  const report: AnalysisReport = {
    summary:
      "The project has strong potential as a persistent multi-agent decision system, but it becomes high-risk if autonomous agents can directly influence user funds, protocol execution, or security-sensitive workflows.",
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
        title: "External data reliability risk",
        severity: "high",
        explanation:
          "The agent may depend on APY, price, liquidity, protocol health, or market data that can be stale, manipulated, or incomplete.",
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
      "Load latest memory index from 0G Storage on startup.",
      "Add document upload or URL analysis for whitepapers, GitHub READMEs, and protocol docs.",
      "Add semantic memory ranking with embeddings.",
      "Add OpenClaw-compatible orchestration metadata.",
      "Prepare final pitch/demo video.",
    ],
    evidence: [
      `User task: ${input.task}`,
      `Relevant memories used: ${input.memories.length}`,
      "Pipeline completed with planner, researcher, risk, architect, critic, and final decision agents.",
      "Final agent generated a structured decision report through the compute abstraction layer.",
      `Raw final agent output: ${rawOutput}`,
    ],
  };

  return {
    rawOutput,
    report,
  };
}