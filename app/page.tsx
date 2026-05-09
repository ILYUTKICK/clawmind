"use client";

import { useState, useEffect } from "react";
import { AgentReasoningFlow } from "@/components/AgentReasoningFlow";
import { InputForm } from "@/components/InputForm";
import { MemoryPanel } from "@/components/MemoryPanel";
import { ReportView } from "@/components/ReportView";
import { StorageReceipt } from "@/components/StorageReceipt";
import { RetrievedReportPanel } from "@/components/RetrievedReportPanel";
import { SystemStatus } from "@/components/SystemStatus";
import { TrackFitPanel } from "@/components/TrackFitPanel";
import { OnChainReceiptPanel } from "@/components/OnChainReceiptPanel";
import { AnalysisResult } from "@/lib/types";
import type { InfrastructureStatus } from "@/lib/infrastructure-status";
import { MemoryIndexReceipt } from "@/components/MemoryIndexReceipt";
import { InfrastructureEvidence } from "@/components/InfrastructureEvidence";
import { MemoryGraph } from "@/components/MemoryGraph";
import { IntegrityPanel } from "@/components/IntegrityPanel";
import { AdversarialPanel } from "@/components/AdversarialPanel";

// ---------------------------------------------------------------------------
// Infrastructure status fetched from /api/status
// Uses the shared InfrastructureStatus type from lib/infrastructure-status
// as the single source of truth. The API response also includes a `timestamp`
// and the backward-compat `storage.is_enabled` alias, but the core fields
// match the shared type.
// ---------------------------------------------------------------------------

type InfraStatus = InfrastructureStatus;

export default function HomePage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [infraStatus, setInfraStatus] = useState<InfraStatus | null>(null);

  // Fetch infrastructure status on mount
  useEffect(() => {
    fetch("/api/status")
      .then((res) => {
        if (!res.ok) throw new Error("Status check failed");
        return res.json();
      })
      .then((data: InfraStatus) => setInfraStatus(data))
      .catch(() => {
        // Silently fail — the page still works without it
      });
  }, []);

  async function runAnalysis(task: string) {
    setIsLoading(true);
    setRequestError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task }),
      });

      const data = (await response.json()) as AnalysisResult & {
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Analysis request failed."
        );
      }

      setAnalysis(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown request error";

      setRequestError(message);
    } finally {
      setIsLoading(false);
    }
  }

  // Dynamic header labels based on real infrastructure status
  const networkLabel = infraStatus
    ? infraStatus.network.name === "mainnet"
      ? "0G Mainnet"
      : "0G Testnet"
    : "0G Network";

  const computeLabel = infraStatus
    ? infraStatus.compute.isConfigured
      ? "0G Compute"
      : "Local Fallback"
    : "0G Compute";

  const storageLabel = infraStatus
    ? infraStatus.storage.isConfigured
      ? "0G Storage"
      : "Local Fallback"
    : "0G Storage";

  // Compute missing config items for the setup warning
  const missingConfig: string[] = [];
  if (infraStatus) {
    if (infraStatus.network.name !== "mainnet") {
      missingConfig.push("ZERO_G_NETWORK=mainnet (contract is on mainnet)");
    }
    if (!infraStatus.storage.isConfigured) {
      missingConfig.push("ZERO_G_STORAGE_ENABLED=true");
      missingConfig.push("ZERO_G_STORAGE_PRIVATE_KEY=<your key>");
    }
    if (!infraStatus.onChain.configured) {
      missingConfig.push("ZERO_G_STORAGE_PRIVATE_KEY (needed for on-chain tx signing)");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_30%)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        {/* Setup Warning Banner */}
        {missingConfig.length > 0 && (
          <div className="rounded-3xl border border-yellow-400/30 bg-yellow-400/5 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">⚠</span>
              <div>
                <h3 className="text-sm font-bold text-yellow-200">0G Mainnet Setup Required</h3>
                <p className="mt-1 text-xs text-yellow-300/80">
                  No on-chain transactions will appear until these .env variables are set. Without this, the hackathon judges cannot verify your 0G integration.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingConfig.map((item) => (
                    <code key={item} className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-2 py-1 text-xs text-yellow-200">
                      {item}
                    </code>
                  ))}
                </div>
                <a
                  href="/api/debug"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-purple-300 underline decoration-purple-400/40 underline-offset-4 hover:text-purple-200"
                >
                  Check /api/debug for full diagnostics →
                </a>
              </div>
            </div>
          </div>
        )}

        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  0G APAC Track 1
                </span>
                {infraStatus?.network && (
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    infraStatus.network.name === "mainnet"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
                  }`}>
                    {networkLabel} (Chain {infraStatus.network.chainId})
                  </span>
                )}
                <a
                  href="/judge"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-200 transition hover:bg-purple-400/20"
                >
                  Judge Mode →
                </a>
              </div>

              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                ClawMind
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
                Persistent multi-agent cognitive backbone for autonomous Web3
                decision-making. Built for 0G Compute, 0G Storage, and
                OpenClaw-oriented orchestration.
              </p>
            </div>

            <div className="grid gap-2 text-sm text-zinc-400">
              <p>
                <span className="text-zinc-200">Mode:</span>{" "}
                <span className={infraStatus?.compute.isConfigured ? "text-emerald-300 font-semibold" : "text-yellow-300"}>
                  Live {networkLabel} Pipeline
                </span>
              </p>
              <p>
                <span className="text-zinc-200">Status:</span>{" "}
                <span className={infraStatus?.storage.isConfigured ? "text-emerald-300 font-semibold" : "text-yellow-300"}>
                  {computeLabel} + {storageLabel}
                </span>
              </p>
              {infraStatus?.onChain.configured && infraStatus.onChain.contractAddress && (
                <p>
                  <span className="text-zinc-200">Contract:</span>{" "}
                  <a
                    href={infraStatus.onChain.explorerUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-cyan-300 underline decoration-cyan-400/40 underline-offset-4 hover:text-cyan-200"
                  >
                    {infraStatus.onChain.contractAddress.slice(0, 10)}...{infraStatus.onChain.contractAddress.slice(-8)}
                  </a>
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-2">
          {/* LEFT COLUMN — Input & Pipeline */}
          <div className="flex flex-col gap-8">
            <InputForm isLoading={isLoading} onSubmit={runAnalysis} />

            {requestError ? (
              <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">
                {requestError}
              </div>
            ) : null}

            <SystemStatus analysis={analysis} infraStatus={infraStatus} />
            <InfrastructureEvidence analysis={analysis} infraStatus={infraStatus} />
            <AgentReasoningFlow
              steps={analysis?.steps || []}
              isLoading={isLoading}
            />
          </div>

          {/* RIGHT COLUMN — Results & Evidence */}
          <div className="flex flex-col gap-8">
            <TrackFitPanel />
            <ReportView report={analysis?.report} />
            {analysis ? (
              <>
                <AdversarialPanel steps={analysis.steps} report={analysis.report} />
                <MemoryGraph
                  memories={analysis.relevantMemories}
                  currentTask={analysis.task}
                  currentReport={analysis.report}
                  storageProvider={analysis.receipt.provider}
                />
                <MemoryPanel memories={analysis.relevantMemories} />
                <StorageReceipt receipt={analysis.receipt} />
                <MemoryIndexReceipt receipt={analysis.memoryIndexReceipt} />
                {analysis.onChainReceipt && analysis.onChainReceipt.provider === "0G_CHAIN" && (
                  <OnChainReceiptPanel receipt={analysis.onChainReceipt} />
                )}
                <IntegrityPanel
                  reportHash={analysis.receipt.reportHash}
                  onChainReceipt={analysis.onChainReceipt}
                />
                <RetrievedReportPanel defaultStorageUri={analysis.receipt.storageUri} />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
