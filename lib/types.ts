export type AgentStatus = "pending" | "running" | "completed" | "failed";

export type AgentName =
  | "memory_retrieval"
  | "planner"
  | "researcher"
  | "risk_agent"
  | "architect"
  | "critic"
  | "final_agent"
  | "memory_writer";

export type AgentStep = {
  name: AgentName;
  label: string;
  status: AgentStatus;
  input?: string;
  output?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Which 0G Compute model was used for this step */
  model?: string;
  /** Short display name for the model family */
  modelFamily?: string;
};

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskItem = {
  title: string;
  severity: RiskSeverity;
  explanation: string;
};

export type Recommendation = "GO" | "NO_GO" | "INVESTIGATE_MORE";

export type AnalysisReport = {
  summary: string;
  score: number;
  recommendation: Recommendation;
  risks: RiskItem[];
  opportunities: string[];
  architecture: string[];
  nextSteps: string[];
  evidence: string[];
};

export type MemoryRecord = {
  id: string;
  task: string;
  summary: string;
  risks: string[];
  recommendation: Recommendation;
  score: number;
  storageUri?: string;
  createdAt: string;
  /** Embedding vector for semantic similarity */
  embedding?: number[];
  /** Cosine similarity score when this memory was retrieved */
  similarityScore?: number;
};

export type StorageReceipt = {
  reportHash: string;
  storageUri?: string;
  provider: "0G_STORAGE" | "LOCAL_FALLBACK";
  createdAt: string;
};

export type OnChainReceipt = {
  analysisId: number;
  txHash: string;
  blockNumber: number;
  contractAddress: string;
  explorerTxUrl: string;
  provider: "0G_CHAIN" | "NOT_CONFIGURED";
};

export type AnalysisResult = {
  task: string;
  steps: AgentStep[];
  relevantMemories: MemoryRecord[];
  report: AnalysisReport;
  receipt: StorageReceipt;
  memoryIndexReceipt?: StorageReceipt;
  onChainReceipt?: OnChainReceipt;
  /** Which models were used for each step */
  modelRouting?: Record<string, string>;
};
