"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { LandingLatestAnalysis } from "./types";

type LiveTickerProps = {
  latestAnalysis: LandingLatestAnalysis | null;
  totalAnalyses: number;
  signedPercentage: number;
  fallbackMessage: string;
  memoryRecords?: number;
  networkLabel?: string;
};

function ageLabel(timestamp: number): string {
  const diffMs = Date.now() - timestamp * 1000;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function shortAddress(value?: string | null): string {
  if (!value) return "authorized operator";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isFresh(timestamp: number): boolean {
  return Date.now() - timestamp * 1000 < 24 * 60 * 60 * 1000;
}

export function LiveTicker({
  latestAnalysis,
  totalAnalyses,
  signedPercentage,
  fallbackMessage,
  memoryRecords = 0,
  networkLabel = "0G mainnet",
}: LiveTickerProps) {
  const router = useRouter();
  const freshLatest = latestAnalysis && isFresh(latestAnalysis.timestamp) ? latestAnalysis : null;

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <section className="border-y border-[var(--cm-border)] bg-[var(--cm-surface-elevated)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-4 font-mono text-xs text-[var(--cm-text-secondary)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-2 text-[var(--cm-accent)]">
              <span className="h-2 w-2 rounded-full bg-[var(--cm-accent)] animate-pulse" />
              LIVE
            </span>
            {freshLatest ? (
              <>
                <span>Latest analysis {ageLabel(freshLatest.timestamp)}</span>
                <span className="text-[var(--cm-text-muted)]">·</span>
                <span>{freshLatest.recommendation} score {freshLatest.score}</span>
                <span className="text-[var(--cm-text-muted)]">·</span>
                <span>
                  signed by {shortAddress(freshLatest.signedBy)}
                  {freshLatest.signatureVerified ? " · verified" : ""}
                </span>
              </>
            ) : (
              <span>{fallbackMessage}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {freshLatest ? (
              <a
                href={freshLatest.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-[var(--cm-text-primary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
              >
                View on 0G explorer ↗
              </a>
            ) : null}
            <Link
              href={freshLatest ? freshLatest.reportHref : "/stats"}
              className="rounded-lg border border-[var(--cm-border)] px-3 py-2 text-[var(--cm-text-primary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
            >
              View full report →
            </Link>
          </div>
        </div>

        <div className="grid gap-2 font-mono text-xs text-[var(--cm-text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/stats" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 transition hover:border-[var(--cm-accent)] hover:text-teal-200">
            {totalAnalyses} analyses
          </Link>
          <Link href="/stats" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 transition hover:border-[var(--cm-accent)] hover:text-teal-200">
            {signedPercentage}% signed
          </Link>
          <Link href="/stats" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 transition hover:border-[var(--cm-accent)] hover:text-teal-200">
            {memoryRecords} memory index records
          </Link>
          <Link href="/stats" className="rounded-lg border border-[var(--cm-border)] px-3 py-2 transition hover:border-[var(--cm-accent)] hover:text-teal-200">
            {networkLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
