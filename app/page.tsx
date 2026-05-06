"use client";

import { useState } from "react";
import { AgentPipeline } from "@/components/AgentPipeline";
import { InputForm } from "@/components/InputForm";
import { MemoryPanel } from "@/components/MemoryPanel";
import { ReportView } from "@/components/ReportView";
import { StorageReceipt } from "@/components/StorageReceipt";
import { RetrievedReportPanel } from "@/components/RetrievedReportPanel";
import { SystemStatus } from "@/components/SystemStatus";
import { TrackFitPanel } from "@/components/TrackFitPanel";
import { AnalysisResult } from "@/lib/types";

export default function HomePage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

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
  const hasPersistentMemories =
    analysis?.relevantMemories.some((memory) =>
      memory.id.startsWith("mem_generated_")
    ) || false;
    
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_30%)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                0G APAC Track 1 MVP
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
                <span className="text-zinc-200">Mode:</span> MVP Mock Pipeline
              </p>
              <p>
                <span className="text-zinc-200">Next:</span> 0G Compute +
                Storage
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-8">
            <InputForm isLoading={isLoading} onSubmit={runAnalysis} />

            {requestError ? (
              <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">
                {requestError}
              </div>
            ) : null}

            <SystemStatus
              receipt={analysis?.receipt}
              hasPersistentMemories={hasPersistentMemories}
            />
            <TrackFitPanel />
            <MemoryPanel memories={analysis?.relevantMemories || []} />
            <StorageReceipt receipt={analysis?.receipt} />
            <RetrievedReportPanel defaultStorageUri={analysis?.receipt.storageUri} />
          </div>

          <div className="flex flex-col gap-8">
            <AgentPipeline
              steps={analysis?.steps || []}
              isLoading={isLoading}
            />
            <ReportView report={analysis?.report} />
          </div>
        </section>
      </div>
    </main>
  );
}