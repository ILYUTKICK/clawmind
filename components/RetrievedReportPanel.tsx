"use client";

import { FormEvent, useState } from "react";
import { AnalysisReport } from "@/lib/types";

type RetrievedReport = {
  rootHash: string;
  storageUri: string;
  task: string;
  report: AnalysisReport;
  createdAt: string;
};

type RetrievedReportPanelProps = {
  defaultStorageUri?: string;
};

export function RetrievedReportPanel({
  defaultStorageUri,
}: RetrievedReportPanelProps) {
  const [storageUriOrRootHash, setStorageUriOrRootHash] = useState(
    defaultStorageUri || ""
  );
  const [retrievedReport, setRetrievedReport] =
    useState<RetrievedReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = storageUriOrRootHash.trim();

    if (value.length < 10) {
      setErrorMessage("Paste a valid 0G storage URI or root hash.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setRetrievedReport(null);

    try {
      const response = await fetch("/api/report/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storageUriOrRootHash: value,
        }),
      });

      const data = (await response.json()) as RetrievedReport & {
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(data.details || data.error || "Retrieval failed.");
      }

      setRetrievedReport(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown retrieval error";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Retrieve Report from 0G Storage
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Paste a Decision Receipt storage URI or root hash to retrieve the
          persisted ClawMind report.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <textarea
          value={storageUriOrRootHash}
          onChange={(event) => setStorageUriOrRootHash(event.target.value)}
          rows={4}
          placeholder="0g://0x..."
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-400"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Retrieving..." : "Retrieve Report"}
        </button>
      </form>

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm leading-6 text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {retrievedReport ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <p className="text-sm font-semibold text-emerald-100">
              Report retrieved successfully from 0G Storage.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Root Hash
            </p>
            <p className="mt-2 break-all font-mono text-sm text-cyan-200">
              {retrievedReport.rootHash}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Original Task
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {retrievedReport.task}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Stored At
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {retrievedReport.createdAt}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-zinc-100">
                Retrieved Decision
              </p>
              <div className="flex gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  Score: {retrievedReport.report.score}/100
                </span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                  {retrievedReport.report.recommendation}
                </span>
              </div>
            </div>

            <p className="text-sm leading-6 text-zinc-400">
              {retrievedReport.report.summary}
            </p>

            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                Risks
              </p>
              <div className="flex flex-wrap gap-2">
                {retrievedReport.report.risks.map((risk) => (
                  <span
                    key={risk.title}
                    className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-100"
                  >
                    {risk.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}