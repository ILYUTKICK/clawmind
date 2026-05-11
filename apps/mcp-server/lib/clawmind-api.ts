import type {
  AnalysisStatusResponse,
  AnalyzeStartResponse,
  AnalyzeToolResult,
  JudgeResponse,
  RecentAnalysis,
} from "./types";

const DEFAULT_API_BASE_URL = "https://clawmind-puce.vercel.app";
const POLL_INTERVAL_MS = 3_000;
const ANALYSIS_TIMEOUT_MS = 285_000;

function getApiBaseUrl(): string {
  const configured =
    process.env.CLAWMIND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_CLAWMIND_API_BASE_URL ||
    DEFAULT_API_BASE_URL;

  return configured.replace(/\/+$/, "");
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `HTTP ${response.status}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assertRecommendation(value: unknown): asserts value is AnalyzeToolResult["recommendation"] {
  if (value !== "GO" && value !== "NO_GO" && value !== "INVESTIGATE_MORE") {
    throw new Error("Analysis completed without a valid recommendation.");
  }
}

export async function analyzeWeb3Project(task: string): Promise<AnalyzeToolResult> {
  const apiBaseUrl = getApiBaseUrl();
  const startResponse = await fetch(`${apiBaseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "clawmind-mcp-server/0.1.0",
    },
    body: JSON.stringify({ task }),
  });

  const startData = await readJson<AnalyzeStartResponse>(startResponse);

  if (!startResponse.ok || !startData.taskId) {
    throw new Error(startData.error || startData.details || "Failed to start analysis.");
  }

  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);

    const statusResponse = await fetch(
      `${apiBaseUrl}/api/status?taskId=${encodeURIComponent(startData.taskId)}`,
      {
        headers: {
          "User-Agent": "clawmind-mcp-server/0.1.0",
        },
      },
    );
    const statusData = await readJson<AnalysisStatusResponse>(statusResponse);

    if (!statusResponse.ok) {
      throw new Error(statusData.error || `Status polling failed with HTTP ${statusResponse.status}.`);
    }

    if (statusData.status === "failed") {
      throw new Error(statusData.error || "Analysis failed.");
    }

    if (statusData.status !== "completed") {
      continue;
    }

    const report = statusData.result?.report;
    const receipt = statusData.result?.receipt;
    const onChainReceipt = statusData.result?.onChainReceipt;

    if (typeof report?.score !== "number") {
      throw new Error("Analysis completed without a numeric score.");
    }

    assertRecommendation(report.recommendation);

    return {
      score: report.score,
      recommendation: report.recommendation,
      reportUri: receipt?.storageUri ?? "",
      taskHash: onChainReceipt?.taskHash ?? "",
      rootHash: receipt?.reportHash ?? "",
      txHash: onChainReceipt?.txHash ?? "",
      signatureVerified: onChainReceipt?.signatureVerified === true,
      explorerUrl: onChainReceipt?.explorerTxUrl ?? "",
    };
  }

  throw new Error("Analysis timed out before the orchestrator returned a final report.");
}

export async function getRecentAnalyses(limit = 5): Promise<RecentAnalysis[]> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/judge`, {
    headers: {
      "User-Agent": "clawmind-mcp-server/0.1.0",
    },
  });
  const data = await readJson<JudgeResponse>(response);

  if (!response.ok) {
    throw new Error(`Judge API failed with HTTP ${response.status}.`);
  }

  const boundedLimit = Math.max(1, Math.min(limit, 20));

  return (data.recentAnalyses ?? []).slice(0, boundedLimit).map((analysis) => ({
    analysisId: analysis.analysisId,
    score: analysis.score,
    recommendation: analysis.recommendation,
    timestamp: analysis.timestamp,
    explorerUrl: analysis.explorerUrl,
  }));
}
