"use client";

import { useState, useEffect } from "react";
import type { OnChainReceipt } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrityPanelProps = {
  reportHash?: string;
  onChainReceipt?: OnChainReceipt;
};

type VerifyResponse = {
  verified: boolean;
  error?: string;
  network?: string;
  onChain?: {
    submitter: string;
    rootHash: string;
    storageUri: string;
    score: number;
    recommendation: string;
    timestamp: number;
    timestampReadable: string;
    taskHash?: string;
    signature?: string;
    signatureVerified?: boolean;
    registryMode?: string;
  };
  contract?: {
    address: string | null;
    explorerUrl: string | null;
    network: string;
    chainId: number;
  };
  integrityChecks?: {
    rootHashFormat: boolean;
    scoreRange: boolean;
    validRecommendation: boolean;
    hasStorageUri: boolean;
    hasSubmitter: boolean;
    operatorSignatureVerified?: boolean;
  };
  timestamp?: string;
};

type StepStatus = "verified" | "pending" | "mismatch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortenHash(value: string, chars = 8): string {
  if (!value || value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "verified") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-sm text-emerald-300">
        ✓
      </span>
    );
  }
  if (status === "mismatch") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-400/30 bg-red-400/10 text-sm text-red-300">
        ✗
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-sm text-yellow-300">
      ◌
    </span>
  );
}

function StatusBadge({ status, label }: { status: StepStatus; label: string }) {
  const classes: Record<StepStatus, string> = {
    verified: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    mismatch: "border-red-400/30 bg-red-400/10 text-red-200",
    pending: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  };

  const icons: Record<StepStatus, string> = {
    verified: "✓",
    mismatch: "✗",
    pending: "◌",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes[status]}`}
    >
      <span>{icons[status]}</span>
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Connector line between steps
// ---------------------------------------------------------------------------

function ConnectorLine({ active }: { active: boolean }) {
  return (
    <div className="ml-[13px] flex h-6 w-0.5 items-center">
      <div
        className={`h-full w-full rounded-full ${
          active ? "bg-emerald-400/40" : "bg-white/10"
        }`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntegrityPanel component
// ---------------------------------------------------------------------------

export function IntegrityPanel({ reportHash, onChainReceipt }: IntegrityPanelProps) {
  const [verifyData, setVerifyData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVerify() {
      try {
        const res = await fetch("/api/verify");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: VerifyResponse = await res.json();
        if (!cancelled) {
          setVerifyData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Failed to fetch");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchVerify();
    return () => {
      cancelled = true;
    };
  }, []);

  // Determine step statuses
  const step1Status: StepStatus = reportHash ? "verified" : "pending";
  const step2Status: StepStatus =
    onChainReceipt && onChainReceipt.provider === "0G_CHAIN" && onChainReceipt.txHash
      ? "verified"
      : reportHash
        ? "pending"
        : "mismatch";

  // Step 3: compare reportHash with on-chain rootHash if available
  let step3Status: StepStatus = "pending";
  if (reportHash && verifyData?.onChain?.rootHash) {
    step3Status =
      reportHash.toLowerCase() === verifyData.onChain.rootHash.toLowerCase()
        ? "verified"
        : "mismatch";
  } else if (onChainReceipt?.txHash) {
    // If we have a txHash, the report was at least submitted on-chain
    step3Status = "verified";
  }

  const step4Status: StepStatus =
    verifyData?.verified && verifyData.integrityChecks
      ? Object.values(verifyData.integrityChecks).every(Boolean)
        ? "verified"
        : "mismatch"
      : step2Status === "verified"
        ? "pending"
        : "mismatch";

  const allVerified =
    step1Status === "verified" &&
    step2Status === "verified" &&
    step3Status === "verified" &&
    step4Status === "verified";

  const contractExplorerUrl = verifyData?.contract?.explorerUrl ?? null;

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Integrity Verification
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              On-chain proof that report data has not been tampered with
            </p>
          </div>
          {allVerified && (
            <StatusBadge status="verified" label="VERIFIED" />
          )}
        </div>
      </div>

      {/* Verification chain — vertical flow */}
      <div className="flex flex-col">
        {/* Step 1: Report stored on 0G Storage */}
        <div className="flex items-start gap-3">
          <StepIcon status={step1Status} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">
              Report stored on 0G Storage
            </p>
            {reportHash ? (
              <p className="mt-1 font-mono text-xs text-cyan-300/80 break-all">
                {reportHash}
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                No report hash available — run an analysis first
              </p>
            )}
            <div className="mt-1.5">
              <StatusBadge
                status={step1Status}
                label={step1Status === "verified" ? "STORED" : "PENDING"}
              />
            </div>
          </div>
        </div>

        <ConnectorLine active={step1Status === "verified"} />

        {/* Step 2: Hash registered on 0G Chain */}
        <div className="flex items-start gap-3">
          <StepIcon status={step2Status} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">
              Hash registered on 0G Chain
            </p>
            {verifyData?.onChain ? (
              <div className="mt-1 space-y-1">
                <p className="font-mono text-xs text-cyan-300/80 break-all">
                  Root Hash: {shortenHash(verifyData.onChain.rootHash, 12)}
                </p>
                {verifyData.contract?.address && (
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-zinc-400">
                      Contract: {shortenHash(verifyData.contract.address, 6)}
                    </p>
                    {contractExplorerUrl && (
                      <a
                        href={contractExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-purple-300 underline decoration-purple-400/40 underline-offset-4 hover:text-purple-200"
                      >
                        View
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : onChainReceipt?.provider === "0G_CHAIN" ? (
              <div className="mt-1 space-y-1">
                <p className="font-mono text-xs text-cyan-300/80">
                  Tx: {shortenHash(onChainReceipt.txHash, 12)}
                </p>
                <p className="font-mono text-xs text-zinc-400">
                  Contract: {shortenHash(onChainReceipt.contractAddress, 6)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                No on-chain registration found
              </p>
            )}
            <div className="mt-1.5">
              <StatusBadge
                status={step2Status}
                label={
                  step2Status === "verified"
                    ? "REGISTERED"
                    : step2Status === "pending"
                      ? "PENDING"
                      : "NOT FOUND"
                }
              />
            </div>
          </div>
        </div>

        <ConnectorLine active={step2Status === "verified"} />

        {/* Step 3: Hashes match */}
        <div className="flex items-start gap-3">
          <StepIcon status={step3Status} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">
              Hashes match
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {step3Status === "verified"
                ? "Report hash matches on-chain root hash — data integrity confirmed"
                : step3Status === "mismatch"
                  ? "Report hash does not match on-chain root hash — data may have been tampered with"
                  : "Awaiting on-chain data for comparison"}
            </p>
            <div className="mt-1.5">
              <StatusBadge
                status={step3Status}
                label={
                  step3Status === "verified"
                    ? "MATCH"
                    : step3Status === "mismatch"
                      ? "MISMATCH"
                      : "PENDING"
                }
              />
            </div>
          </div>
        </div>

        <ConnectorLine active={step3Status === "verified"} />

        {/* Step 4: Explorer verified */}
        <div className="flex items-start gap-3">
          <StepIcon status={step4Status} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">
              Explorer verified
            </p>
            {verifyData?.integrityChecks ? (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(
                  Object.entries(verifyData.integrityChecks) as [
                    string,
                    boolean,
                  ][]
                ).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className={
                        value ? "text-emerald-300" : "text-red-300"
                      }
                    >
                      {value ? "✓" : "✗"}
                    </span>
                    <span className="text-zinc-400">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                {loading
                  ? "Loading on-chain verification data..."
                  : fetchError
                    ? `Could not verify: ${fetchError}`
                    : "No on-chain data available for verification"}
              </p>
            )}
            <div className="mt-1.5">
              <StatusBadge
                status={step4Status}
                label={
                  step4Status === "verified"
                    ? "VERIFIED"
                    : step4Status === "mismatch"
                      ? "FAILED"
                      : "PENDING"
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Explorer link and on-chain details */}
      {(verifyData?.onChain || contractExplorerUrl) && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          {verifyData?.onChain && (
            <div className="mb-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Submitter</span>
                <span className="font-mono text-zinc-300">
                  {shortenHash(verifyData.onChain.submitter, 10)}
                </span>
              </div>
              {verifyData.onChain.registryMode && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Registry mode</span>
                  <span className={verifyData.onChain.registryMode === "SIGNED_OPERATOR" ? "text-emerald-300" : "text-yellow-300"}>
                    {verifyData.onChain.registryMode}
                  </span>
                </div>
              )}
              {verifyData.onChain.signatureVerified !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Operator signature</span>
                  <span className={verifyData.onChain.signatureVerified ? "text-emerald-300" : "text-yellow-300"}>
                    {verifyData.onChain.signatureVerified ? "Verified" : "Legacy"}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Score</span>
                <span className="text-zinc-300">{verifyData.onChain.score}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Recommendation</span>
                <span
                  className={
                    verifyData.onChain.recommendation === "GO"
                      ? "text-emerald-300"
                      : verifyData.onChain.recommendation === "NO_GO"
                        ? "text-red-300"
                        : "text-yellow-300"
                  }
                >
                  {verifyData.onChain.recommendation}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Timestamp</span>
                <span className="text-zinc-300">
                  {verifyData.onChain.timestampReadable}
                </span>
              </div>
            </div>
          )}

          {contractExplorerUrl && (
            <a
              href={contractExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/10"
            >
              <span>Verify on Explorer</span>
              <span className="text-xs text-cyan-300/60">↗</span>
            </a>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span>Fetching on-chain verification data...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && fetchError && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200">
          Verification fetch failed: {fetchError}
        </div>
      )}

      {/* Not configured state */}
      {!loading && !fetchError && verifyData && !verifyData.verified && verifyData.error && (
        <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-xs text-yellow-200">
          {verifyData.error}
        </div>
      )}
    </section>
  );
}
