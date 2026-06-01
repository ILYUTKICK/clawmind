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
  {
    id: "mem_seed_004",
    task: "Review a read-only Web3 analytics dashboard for Uniswap pools with no wallet connection.",
    summary:
      "Read-only analytics with public indexed data is usually low risk when it cannot sign transactions, custody funds, or mutate protocol state.",
    risks: ["Data freshness", "Misleading analytics", "Source attribution gaps"],
    recommendation: "GO",
    score: 86,
    createdAt: "2026-05-04T12:00:00.000Z",
  },
  {
    id: "mem_seed_005",
    task: "Evaluate an autonomous trading agent that stores a private key in an environment variable.",
    summary:
      "Autonomous fund movement plus exposed signing material creates a direct loss path and should be blocked until custody and withdrawal controls are redesigned.",
    risks: ["Private key exposure", "Autonomous fund movement", "Missing withdrawal guards"],
    recommendation: "NO_GO",
    score: 14,
    createdAt: "2026-05-04T12:30:00.000Z",
  },
  {
    id: "mem_seed_006",
    task: "Assess an upgradeable cross-chain bridge before mainnet launch.",
    summary:
      "Bridge designs need conservative treatment because upgrade keys, oracle dependencies, replay protection, and liquidity concentration can create systemic loss scenarios.",
    risks: ["Bridge exploit surface", "Admin key compromise", "Oracle or relayer failure"],
    recommendation: "INVESTIGATE_MORE",
    score: 38,
    createdAt: "2026-05-04T13:00:00.000Z",
  },
  {
    id: "mem_seed_007",
    task: "Review a new AMM with a novel TWAP oracle and limited audit coverage.",
    summary:
      "Novel pricing logic should remain in investigation until oracle manipulation tests, liquidity assumptions, and audit scope are verified against the deployed fork.",
    risks: ["Oracle manipulation", "Thin liquidity", "Incomplete audit scope"],
    recommendation: "INVESTIGATE_MORE",
    score: 47,
    createdAt: "2026-05-04T13:30:00.000Z",
  },
  {
    id: "mem_seed_008",
    task: "Evaluate a DAO treasury manager with multisig approvals and timelocked upgrades.",
    summary:
      "Human approvals, multisig custody, timelocks, and public parameter history can make treasury automation acceptable when emergency powers are narrow and observable.",
    risks: ["Governance capture", "Emergency admin abuse", "Parameter drift"],
    recommendation: "GO",
    score: 78,
    createdAt: "2026-05-04T14:00:00.000Z",
  },
  {
    id: "mem_seed_009",
    task: "Assess a wallet extension that suggests transactions to users but requires explicit signing.",
    summary:
      "Wallet assistants can be viable when they never hold keys, show deterministic transaction simulations, and require explicit user confirmation for every action.",
    risks: ["Phishing-style prompts", "Simulation mismatch", "Permission overreach"],
    recommendation: "INVESTIGATE_MORE",
    score: 64,
    createdAt: "2026-05-04T14:30:00.000Z",
  },
  {
    id: "mem_seed_010",
    task: "Review a staking protocol with audited contracts but centralized validator operations.",
    summary:
      "Audits help contract confidence, but validator concentration, slashing handling, and withdrawal authority still need operational evidence before a full approval.",
    risks: ["Validator concentration", "Slashing exposure", "Withdrawal authority"],
    recommendation: "INVESTIGATE_MORE",
    score: 58,
    createdAt: "2026-05-04T15:00:00.000Z",
  },
  {
    id: "mem_seed_011",
    task: "Evaluate an NFT marketplace escrow that temporarily holds user assets.",
    summary:
      "Escrow flows require strict release conditions, pause semantics, dispute handling, and marketplace fee transparency because user assets are temporarily custodied.",
    risks: ["Escrow custody", "Dispute handling gaps", "Pause abuse"],
    recommendation: "INVESTIGATE_MORE",
    score: 52,
    createdAt: "2026-05-04T15:30:00.000Z",
  },
  {
    id: "mem_seed_012",
    task: "Assess a DeFi protocol with anonymous founders, unaudited contracts, and planned high TVL.",
    summary:
      "Anonymous ownership is not automatically fatal, but unaudited contracts and planned high TVL make the launch unsafe without audits, bug bounty, and staged caps.",
    risks: ["Unaudited contracts", "Anonymous ownership", "High TVL launch risk"],
    recommendation: "NO_GO",
    score: 22,
    createdAt: "2026-05-04T16:00:00.000Z",
  },
  {
    id: "mem_seed_013",
    task: "Review a public data indexer API used by downstream trading bots.",
    summary:
      "Read-only infrastructure can still become high impact when downstream systems trade from it, so freshness guarantees, outage behavior, and data provenance matter.",
    risks: ["Stale indexed data", "Downstream automation reliance", "Weak provenance"],
    recommendation: "INVESTIGATE_MORE",
    score: 66,
    createdAt: "2026-05-04T16:30:00.000Z",
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
