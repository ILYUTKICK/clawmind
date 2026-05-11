"use client";

import { useState } from "react";
import { AnalysisReport, OnChainReceipt, RiskSeverity } from "@/lib/types";

type ReportViewProps = {
  report?: AnalysisReport;
  task?: string;
  receipt?: {
    reportHash?: string;
    storageUri?: string;
    provider?: string;
  };
  onChainReceipt?: OnChainReceipt;
};

function severityClass(severity: RiskSeverity): string {
  if (severity === "critical") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }

  if (severity === "high") {
    return "border-orange-400/30 bg-orange-400/10 text-orange-200";
  }

  if (severity === "medium") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }

  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
}

function recommendationClass(recommendation: AnalysisReport["recommendation"]) {
  if (recommendation === "GO") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (recommendation === "NO_GO") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }

  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export function ReportView({ report, task, receipt, onChainReceipt }: ReportViewProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadPdf() {
    if (!report || !task) return;
    setPdfLoading(true);
    try {
      const response = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, report, receipt, onChainReceipt }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clawmind-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download failed:", error);
    } finally {
      setPdfLoading(false);
    }
  }

  if (!report) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Final Report</h2>
        <p className="mt-3 text-sm text-zinc-500">
          Run an analysis to generate a structured report.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Final Report</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            {report.summary}
          </p>
        </div>

        <div className="flex flex-row gap-2 sm:flex-col sm:items-end">
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100">
            Score: {report.score}/100
          </div>
          <div
            className={`rounded-2xl border px-4 py-2 text-sm font-bold ${recommendationClass(
              report.recommendation
            )}`}
          >
            {report.recommendation}
          </div>
          <button
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="rounded-2xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="grid gap-5">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Risk Map
          </h3>
          <div className="grid gap-3">
            {report.risks.map((risk) => (
              <article
                key={risk.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-zinc-100">{risk.title}</p>
                  <span
                    className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${severityClass(
                      risk.severity
                    )}`}
                  >
                    {risk.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {risk.explanation}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Opportunities
            </h3>
            <ul className="space-y-2">
              {report.opportunities.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-400"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Architecture
            </h3>
            <ul className="space-y-2">
              {report.architecture.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-400"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Next Steps
          </h3>
          <ol className="space-y-2">
            {report.nextSteps.map((item, index) => (
              <li
                key={item}
                className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-400"
              >
                <span className="mr-2 font-semibold text-cyan-200">
                  {index + 1}.
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Evidence Log
          </h3>
          <ul className="space-y-2">
            {report.evidence.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-zinc-500"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
