export type AgentStatus = "pending" | "running" | "completed" | "failed";
export type ValidationMode = "NO_SCHEMA" | "WEAK" | "STRICT" | "RETRY" | "FALLBACK";
export type AgentProvider =
  | "0G_COMPUTE"
  | "0G_STORAGE"
  | "0G_CHAIN"
  | "LOCAL_EMBEDDINGS"
  | "LOCAL_FALLBACK"
  | "NOT_CONFIGURED";
export type AgentCostStatus = "not_reported" | "not_applicable";

export type AgentName =
  | "memory_retrieval"
  | "planner"
  | "researcher"
  | "risk_agent"
  | "architect"
  | "critic"
  | "final_agent"
  | "report_storage"
  | "memory_writer"
  | "memory_index"
  | "onchain_registry";

export type AgentStep = {
  name: AgentName;
  label: string;
  status: AgentStatus;
  input?: string;
  output?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  model?: string;  
  modelFamily?: string;
  modelId?: string;
  provider?: AgentProvider;
  inputChars?: number;
  outputChars?: number;
  costStatus?: AgentCostStatus;
  skill?: string;
  validation?: {
    validated: boolean;
    mode?: ValidationMode;   // ← было string
    retries?: number;
    retriesUsed?: number;
    model?: string;
    finalModel?: string;
    errors?: string[];
    structuredData?: unknown; 
  };
};

export type AgentTraceSnapshot = {
  name: AgentName;
  label: string;
  status: AgentStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  model?: string;
  modelFamily?: string;
  provider?: AgentProvider;
  inputChars?: number;
  outputChars?: number;
  error?: string;
  costStatus: AgentCostStatus;
};

export type AnalysisTraceSummary = {
  totalDurationMs: number;
  completedSteps: number;
  failedSteps: number;
  providerBreakdown: Record<string, number>;
  slowestStep?: AgentTraceSnapshot;
  steps: AgentTraceSnapshot[];
};

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskItem = {
  title: string;
  severity: RiskSeverity;
  explanation: string;
};

export type Recommendation = "GO" | "NO_GO" | "INVESTIGATE_MORE";
export type AnalysisSource = "web" | "mcp";

export type AnalysisReport = {
  summary: string;
  score: number;
  recommendation: Recommendation;
  risks: RiskItem[];
  opportunities: string[];
  architecture: string[];
  nextSteps: string[];
  evidence: string[];
  criticAdjustment?: {
    totalChallenges: number;
    resolvedChallenges: number;
    unresolvedChallenges: number;
    unresolvedHigh: number;
    unresolvedMedium: number;
    unresolvedLow: number;
    penalty: number;
    baseScore: number;
    finalScore: number;
    math: string;
  };
};

export type MemoryRecord = {
  id: string;
  task: string;
  summary: string;
  risks: string[];
  recommendation: Recommendation;
  score: number;
  storageUri?: string;
  embedding?: number[];
  similarityScore?: number;   // ← ДОБАВИТЬ ЭТО
  createdAt: string;
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
  taskHash?: string;
  signature?: string;
  signedBy?: string;
  signatureVerified?: boolean;
  registryMode?: "SIGNED_OPERATOR" | "LEGACY_UNAUTHENTICATED";
};

export type AnalysisResult = {
  task: string;
  steps: AgentStep[];
  relevantMemories: MemoryRecord[];
  report: AnalysisReport;
  receipt: StorageReceipt;
  memoryIndexReceipt?: StorageReceipt;
  onChainReceipt?: OnChainReceipt;
  modelRouting?: Record<string, unknown>;
};
