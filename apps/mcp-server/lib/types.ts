export type Recommendation = "GO" | "NO_GO" | "INVESTIGATE_MORE";

export type AnalyzeToolResult = {
  score: number;
  recommendation: Recommendation;
  reportUri: string;
  taskHash: string;
  rootHash: string;
  txHash: string;
  signatureVerified: boolean;
  explorerUrl: string;
};

export type RecentAnalysis = {
  analysisId: number;
  score: number;
  recommendation: string;
  timestamp: number;
  explorerUrl: string;
};

export type AnalyzeStartResponse = {
  taskId?: string;
  status?: string;
  error?: string;
  details?: string;
};

export type AnalysisStatusResponse = {
  status?: "running" | "completed" | "failed";
  error?: string | null;
  result?: {
    report?: {
      score?: number;
      recommendation?: Recommendation;
    };
    receipt?: {
      reportHash?: string;
      storageUri?: string;
    };
    onChainReceipt?: {
      txHash?: string;
      explorerTxUrl?: string;
      taskHash?: string;
      signatureVerified?: boolean;
    };
  } | null;
};

export type JudgeResponse = {
  recentAnalyses?: RecentAnalysis[];
};
