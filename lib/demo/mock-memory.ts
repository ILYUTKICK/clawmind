import { MemoryRecord } from "@/lib/types";

export const mockMemories: MemoryRecord[] = [
  {
    id: "mem_001",
    task: "Analyze autonomous DeFi agent managing user funds across yield protocols.",
    summary:
      "The previous analysis found strong product potential but serious custody, oracle, and autonomous execution risks.",
    risks: ["Custody risk", "Oracle manipulation", "Unsafe autonomous execution"],
    recommendation: "INVESTIGATE_MORE",
    score: 68,
    storageUri: "0g://storage/demo/mem_001",
    createdAt: "2026-05-04T09:00:00.000Z",
  },
  {
    id: "mem_002",
    task: "Evaluate AI agent that signs transactions on behalf of users.",
    summary:
      "The agent design required strict transaction policies, simulation before execution, and human approval for high-risk operations.",
    risks: ["Private key exposure", "Policy bypass", "LLM hallucinated actions"],
    recommendation: "NO_GO",
    score: 41,
    storageUri: "0g://storage/demo/mem_002",
    createdAt: "2026-05-04T10:15:00.000Z",
  },
  {
    id: "mem_003",
    task: "Assess Web3 AI assistant for protocol due diligence.",
    summary:
      "The assistant was useful for research workflows because it produced structured evidence logs and reusable risk patterns.",
    risks: ["Incomplete source coverage", "Overconfidence", "Weak provenance"],
    recommendation: "GO",
    score: 82,
    storageUri: "0g://storage/demo/mem_003",
    createdAt: "2026-05-04T11:30:00.000Z",
  },
];

export function findRelevantMockMemories(task: string): MemoryRecord[] {
  const normalizedTask = task.toLowerCase();

  const scored = mockMemories.map((memory) => {
    const searchableText = [
      memory.task,
      memory.summary,
      ...memory.risks,
      memory.recommendation,
      String(memory.score),
    ]
      .join(" ")
      .toLowerCase();

    const keywords = normalizedTask
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9]/g, ""))
      .filter((word) => word.length > 3);

    const score = keywords.reduce((total, keyword) => {
      return searchableText.includes(keyword) ? total + 1 : total;
    }, 0);

    return { memory, score };
  });

  const relevant = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.memory)
    .slice(0, 2);

  if (relevant.length > 0) {
    return relevant;
  }

  return mockMemories.slice(0, 1);
}