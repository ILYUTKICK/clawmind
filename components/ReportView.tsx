"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
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
  if (severity === "critical" || severity === "high") {
    return "border-[var(--cm-critical)] bg-[var(--cm-critical)]/10 text-red-200";
  }

  if (severity === "medium") {
    return "border-[var(--cm-warning)] bg-[var(--cm-warning)]/10 text-amber-200";
  }

  return "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200";
}

function recommendationClass(recommendation: AnalysisReport["recommendation"]) {
  if (recommendation === "GO") {
    return "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200";
  }

  if (recommendation === "NO_GO") {
    return "border-[var(--cm-critical)] bg-[var(--cm-critical)]/10 text-red-200";
  }

  return "border-[var(--cm-warning)] bg-[var(--cm-warning)]/10 text-amber-200";
}

function scoreColor(report: AnalysisReport): string {
  if (report.recommendation === "GO") {
    return "var(--cm-accent)";
  }

  if (report.recommendation === "NO_GO") {
    return "var(--cm-critical)";
  }

  return "var(--cm-warning)";
}

function ReportSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-[var(--cm-border)] bg-black/20"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm font-semibold text-[var(--cm-text-primary)]">{title}</span>
        <span className="flex items-center gap-3">
          {typeof count === "number" ? (
            <span className="rounded-md border border-[var(--cm-border)] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-[var(--cm-text-muted)]">
              {count}
            </span>
          ) : null}
          <span className="text-[var(--cm-text-muted)] transition group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="border-t border-[var(--cm-border)] px-4 py-4">{children}</div>
    </details>
  );
}

function ScoreDial({ report }: { report: AnalysisReport }) {
  const accent = scoreColor(report);
  const style = {
    background: `conic-gradient(${accent} ${Math.max(0, Math.min(100, report.score)) * 3.6}deg, var(--cm-border) 0deg)`,
  } satisfies CSSProperties;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-44 w-44 items-center justify-center rounded-full p-2" style={style}>
        <div className="absolute inset-2 rounded-full bg-[var(--cm-surface)]" />
        <div className="relative text-center">
          <p className="font-mono text-6xl font-semibold leading-none text-[var(--cm-text-primary)]">
            {report.score}
          </p>
          <p className="mt-1 text-xs uppercase text-[var(--cm-text-muted)]">score</p>
        </div>
      </div>
      <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${recommendationClass(report.recommendation)}`}>
        {report.recommendation}
      </span>
    </div>
  );
}

function MonoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase text-[var(--cm-text-muted)]">{label}</p>
      <p className="mt-1 truncate font-mono text-xs text-zinc-300">{value}</p>
    </div>
  );
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
      <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
        <p className="text-xs uppercase text-[var(--cm-text-muted)]">Final Report</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--cm-text-primary)]">No report yet</h2>
        <p className="mt-3 text-sm text-[var(--cm-text-muted)]">
          Run an analysis to generate a structured report.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ScoreDial report={report} />

        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase text-[var(--cm-text-muted)]">Final Report</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--cm-text-primary)]">
                Decision summary
              </h2>
            </div>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="h-10 rounded-lg border border-[var(--cm-border)] bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition hover:border-[var(--cm-accent)] hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pdfLoading ? "Generating" : "PDF"}
            </button>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">{report.summary}</p>

          {(receipt?.storageUri || onChainReceipt?.txHash) && (
            <div className="mt-5 grid gap-3 border-y border-[var(--cm-border)] py-4 sm:grid-cols-2">
              {receipt?.storageUri ? <MonoValue label="report uri" value={receipt.storageUri} /> : null}
              {onChainReceipt?.txHash ? <MonoValue label="tx hash" value={onChainReceipt.txHash} /> : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <ReportSection title="Risks" count={report.risks.length}>
          <div className="space-y-3">
            {report.risks.map((risk) => (
              <article key={risk.title} className="border-b border-[var(--cm-border)] pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <p className="font-semibold text-[var(--cm-text-primary)]">{risk.title}</p>
                  <span className={`w-fit rounded-md border px-2 py-1 text-[11px] font-semibold ${severityClass(risk.severity)}`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--cm-text-muted)]">{risk.explanation}</p>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Architecture" count={report.architecture.length}>
          <ul className="space-y-3">
            {report.architecture.map((item) => (
              <li key={item} className="text-sm leading-6 text-zinc-300">
                {item}
              </li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection
          title="Findings"
          count={report.opportunities.length + report.nextSteps.length + report.evidence.length}
          defaultOpen={false}
        >
          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-[var(--cm-text-muted)]">Opportunities</p>
              <ul className="space-y-2">
                {report.opportunities.map((item) => (
                  <li key={item} className="text-sm leading-6 text-zinc-300">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-[var(--cm-text-muted)]">Next steps</p>
              <ol className="space-y-2">
                {report.nextSteps.map((item, index) => (
                  <li key={item} className="text-sm leading-6 text-zinc-300">
                    <span className="mr-2 font-mono text-[var(--cm-accent)]">{index + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-[var(--cm-text-muted)]">Evidence</p>
              <ul className="space-y-2">
                {report.evidence.map((item) => (
                  <li key={item} className="font-mono text-xs leading-5 text-[var(--cm-text-muted)]">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </ReportSection>
      </div>
    </section>
  );
}
