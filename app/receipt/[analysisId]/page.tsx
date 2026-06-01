import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAnalysisFromChainById } from "@/lib/contracts/analysis-registry";
import type { AnalysisRegistryRecord } from "@/lib/contracts/analysis-registry";
import {
  retrieveReportFromZeroGStorage,
} from "@/lib/storage/zero-g-retrieval";
import type { RetrievedReportResult } from "@/lib/storage/zero-g-retrieval";
import type { AnalysisReport } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReceiptPageProps = {
  params: Promise<{
    analysisId: string;
  }>;
};

type ReportLoadResult =
  | {
      ok: true;
      data: RetrievedReportResult;
    }
  | {
      ok: false;
      error: string;
    };

function parseAnalysisId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp * 1_000));
}

function recommendationTone(recommendation: string) {
  if (recommendation === "GO") {
    return {
      badge: "border-[var(--cm-accent)] bg-[var(--cm-accent)]/10 text-teal-200",
      text: "text-[var(--cm-accent)]",
    };
  }

  if (recommendation === "NO_GO") {
    return {
      badge: "border-[var(--cm-critical)] bg-[var(--cm-critical)]/10 text-red-200",
      text: "text-[var(--cm-critical)]",
    };
  }

  return {
    badge: "border-[var(--cm-warning)] bg-[var(--cm-warning)]/10 text-amber-200",
    text: "text-[var(--cm-warning)]",
  };
}

function metricToneForRecommendation(
  recommendation: string,
): "accent" | "warning" | "critical" | undefined {
  if (recommendation === "GO") {
    return "accent";
  }

  if (recommendation === "NO_GO") {
    return "critical";
  }

  return "warning";
}

async function loadReport(storageUri: string): Promise<ReportLoadResult> {
  try {
    const data = await retrieveReportFromZeroGStorage(storageUri);

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown retrieval error",
    };
  }
}

function FieldRow({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value?: string | number | boolean | null;
  href?: string;
  tone?: "accent" | "warning" | "critical";
}) {
  const displayValue =
    typeof value === "boolean" ? (value ? "true" : "false") : value ?? "not available";
  const toneClass =
    tone === "accent"
      ? "text-[var(--cm-accent)]"
      : tone === "warning"
        ? "text-[var(--cm-warning)]"
        : tone === "critical"
          ? "text-[var(--cm-critical)]"
          : "text-[var(--cm-text-secondary)]";

  return (
    <div className="grid gap-2 border-b border-[var(--cm-border)] py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)]">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`break-all font-mono text-sm transition hover:text-teal-200 ${toneClass}`}
        >
          {String(displayValue)}
        </a>
      ) : (
        <span className={`break-all font-mono text-sm ${toneClass}`}>
          {String(displayValue)}
        </span>
      )}
    </div>
  );
}

function MetricBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "accent" | "warning" | "critical";
}) {
  const toneClass =
    tone === "accent"
      ? "text-[var(--cm-accent)]"
      : tone === "warning"
        ? "text-[var(--cm-warning)]"
        : tone === "critical"
          ? "text-[var(--cm-critical)]"
          : "text-[var(--cm-text-primary)]";

  return (
    <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
        {label}
      </p>
      <p className={`mt-3 font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ReportPreview({
  report,
  task,
}: {
  report: AnalysisReport;
  task: string;
}) {
  const tone = recommendationTone(report.recommendation);
  const topRisks = report.risks.slice(0, 4);
  const topEvidence = report.evidence.slice(0, 4);

  return (
    <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <div className="flex flex-col gap-4 border-b border-[var(--cm-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--cm-text-muted)]">
            Retrieved Report
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--cm-text-primary)]">
            Decision summary
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--cm-text-secondary)]">
            {report.summary}
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-3">
          <MetricBox label="Score" value={report.score} tone={metricToneForRecommendation(report.recommendation)} />
          <div className={`rounded-lg border px-4 py-3 font-mono text-xs uppercase ${tone.badge}`}>
            {report.recommendation}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
          Task
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--cm-text-secondary)]">{task}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
            Top risks
          </p>
          <div className="mt-4 space-y-3">
            {topRisks.length > 0 ? (
              topRisks.map((risk) => (
                <div key={`${risk.title}-${risk.severity}`} className="border-b border-[var(--cm-border)] pb-3 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--cm-text-primary)]">{risk.title}</p>
                    <span className="rounded-md border border-[var(--cm-border)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--cm-text-muted)]">
                      {risk.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--cm-text-secondary)]">
                    {risk.explanation}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--cm-text-muted)]">No risks listed.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--cm-text-muted)]">
            Evidence
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--cm-text-secondary)]">
            {topEvidence.length > 0 ? (
              topEvidence.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>No evidence listed.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProofPanel({
  record,
  reportLoad,
}: {
  record: AnalysisRegistryRecord;
  reportLoad: ReportLoadResult;
}) {
  const retrievedRootHash = reportLoad.ok ? reportLoad.data.rootHash : null;
  const hashMatches =
    retrievedRootHash &&
    retrievedRootHash.toLowerCase() === record.rootHash.toLowerCase();

  return (
    <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <div className="border-b border-[var(--cm-border)] pb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--cm-text-muted)]">
          Integrity Proof
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--cm-text-primary)]">
          On-chain receipt
        </h2>
      </div>

      <div className="mt-3">
        <FieldRow label="Analysis ID" value={`#${record.analysisId}`} tone="accent" />
        <FieldRow label="Registry mode" value={record.registryMode} tone={record.registryMode === "SIGNED_OPERATOR" ? "accent" : "warning"} />
        <FieldRow label="Signature verified" value={record.signatureVerified ? "verified" : "not observed"} tone={record.signatureVerified ? "accent" : "warning"} />
        <FieldRow label="Submitter" value={record.submitter} />
        <FieldRow label="Task hash" value={record.taskHash} />
        <FieldRow label="Root hash" value={record.rootHash} />
        <FieldRow label="0G report URI" value={record.storageUri} />
        <FieldRow label="Report hash check" value={hashMatches ? "retrieved file matches root hash" : reportLoad.ok ? "retrieved root mismatch" : "report retrieval unavailable"} tone={hashMatches ? "accent" : "warning"} />
        <FieldRow label="Signature" value={record.signature} />
        <FieldRow label="Transaction" value={record.txHash} href={record.txExplorerUrl} />
        <FieldRow label="Block" value={record.blockNumber} href={record.blockExplorerUrl} />
        <FieldRow label="Contract" value={record.contractAddress} href={record.contractExplorerUrl} />
        <FieldRow label="Timestamp" value={`${formatTimestamp(record.timestamp)} UTC`} />
      </div>

      {!reportLoad.ok ? (
        <div className="mt-5 rounded-lg border border-[var(--cm-warning)]/40 bg-[var(--cm-warning)]/5 p-4 text-sm leading-6 text-[var(--cm-warning)]">
          Report retrieval failed: {reportLoad.error}
        </div>
      ) : null}
    </section>
  );
}

export async function generateMetadata({
  params,
}: ReceiptPageProps): Promise<Metadata> {
  const { analysisId } = await params;

  return {
    title: `ClawMind Receipt #${analysisId}`,
    description: "Verifiable ClawMind analysis receipt anchored on 0G Chain.",
  };
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { analysisId: rawAnalysisId } = await params;
  const analysisId = parseAnalysisId(rawAnalysisId);

  if (!analysisId) {
    notFound();
  }

  const record = await getAnalysisFromChainById(analysisId);

  if (!record) {
    notFound();
  }

  const reportLoad = await loadReport(record.storageUri);
  const report = reportLoad.ok ? reportLoad.data.report : null;
  const task = reportLoad.ok ? reportLoad.data.task : null;
  const tone = recommendationTone(record.recommendation);

  return (
    <main className="min-h-screen bg-[var(--cm-background)] text-[var(--cm-text-primary)]">
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cm-border)] pb-5">
          <Link href="/" className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--cm-accent)]">
            ClawMind
          </Link>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <Link href="/analysis" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200">
              Run analysis
            </Link>
            <Link href="/stats" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200">
              Stats
            </Link>
            <a href={record.contractExplorerUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200">
              Explorer
            </a>
          </div>
        </nav>

        <section className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--cm-text-muted)]">
              0G mainnet receipt
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--cm-text-primary)] sm:text-5xl">
              Receipt #{record.analysisId}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--cm-text-secondary)]">
              This page reads the signed registry entry from 0G Chain and retrieves
              the immutable report from 0G Storage when available.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="Score" value={record.score} tone={metricToneForRecommendation(record.recommendation)} />
            <div className={`rounded-lg border px-4 py-3 font-mono text-xs uppercase ${tone.badge}`}>
              {record.recommendation}
            </div>
            <MetricBox label="Signature" value={record.signatureVerified ? "verified" : "pending"} tone={record.signatureVerified ? "accent" : "warning"} />
            <MetricBox label="Registry" value={record.registryMode === "SIGNED_OPERATOR" ? "signed" : "legacy"} tone={record.registryMode === "SIGNED_OPERATOR" ? "accent" : "warning"} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          {report && task ? (
            <ReportPreview report={report} task={task} />
          ) : (
            <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--cm-text-muted)]">
                Retrieved Report
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--cm-text-primary)]">
                Report unavailable
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--cm-text-secondary)]">
                The on-chain receipt is available, but the report body could not be
                retrieved from 0G Storage at render time.
              </p>
            </section>
          )}

          <ProofPanel record={record} reportLoad={reportLoad} />
        </div>
      </div>
    </main>
  );
}
