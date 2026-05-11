"use client";

import { useEffect, useState } from "react";
import type { OnChainReceipt } from "@/lib/types";

type IntegrityPanelProps = {
  reportHash?: string;
  onChainReceipt?: OnChainReceipt;
};

type VerifyResponse = {
  verified: boolean;
  error?: string;
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
};

function shortenHash(value: string, head = 6, tail = 4): string {
  if (!value || value.length <= head + tail + 5) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function contractExplorerUrl(contractAddress: string | undefined, txUrl: string | undefined, verifyUrl: string | null | undefined): string | null {
  if (verifyUrl) {
    return verifyUrl;
  }

  if (contractAddress && txUrl) {
    return txUrl.replace(/\/tx\/.*$/, `/address/${contractAddress}`);
  }

  return null;
}

function boolLabel(value: boolean | undefined): string {
  if (value === true) {
    return "verified by contract";
  }

  if (value === false) {
    return "not verified";
  }

  return "pending";
}

function CopyButton({
  value,
  copied,
  onCopy,
}: {
  value?: string;
  copied: boolean;
  onCopy: (value: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={!value}
      onClick={() => value && onCopy(value)}
      className="rounded-md border border-[var(--cm-border)] bg-white/[0.03] px-2 py-1 text-[11px] font-semibold text-[var(--cm-text-muted)] transition hover:border-[var(--cm-accent)] hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function ReceiptRow({
  label,
  value,
  copyValue,
  actionHref,
  actionLabel,
  verified,
  copied,
  onCopy,
}: {
  label: string;
  value?: string;
  copyValue?: string;
  actionHref?: string | null;
  actionLabel?: string;
  verified?: boolean;
  copied: boolean;
  onCopy: (value: string) => void;
}) {
  const displayValue = value && value.length > 0 ? value : "pending";

  return (
    <div className="grid gap-2 border-b border-[var(--cm-border)] py-3 last:border-b-0 md:grid-cols-[132px_minmax(0,1fr)_auto] md:items-center">
      <p className="text-[11px] font-semibold uppercase text-[var(--cm-text-muted)]">{label}</p>
      <div className="min-w-0">
        <p className="truncate [font-family:var(--cm-font-mono)] text-xs text-zinc-200">
          {displayValue}
        </p>
        {typeof verified === "boolean" ? (
          <p className={verified ? "mt-1 text-xs font-semibold text-[var(--cm-accent)]" : "mt-1 text-xs font-semibold text-[var(--cm-warning)]"}>
            {verified ? "✓ verified by contract" : boolLabel(verified)}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <CopyButton value={copyValue ?? value} copied={copied} onCopy={onCopy} />
        {actionHref ? (
          <a
            href={actionHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[var(--cm-accent)]/40 bg-[var(--cm-accent)]/10 px-2 py-1 text-[11px] font-semibold text-teal-200 transition hover:bg-[var(--cm-accent)]/20"
          >
            {actionLabel ?? "view ↗"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CheckLine({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--cm-border)] bg-black/20 px-3 py-2">
      <span className="text-xs text-[var(--cm-text-muted)]">{label}</span>
      <span className={value ? "font-mono text-xs text-[var(--cm-accent)]" : "font-mono text-xs text-[var(--cm-warning)]"}>
        {value ? "pass" : "pending"}
      </span>
    </div>
  );
}

export function IntegrityPanel({ reportHash, onChainReceipt }: IntegrityPanelProps) {
  const [verifyData, setVerifyData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVerify() {
      try {
        const res = await fetch("/api/verify");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as VerifyResponse;

        if (!cancelled) {
          setVerifyData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : "Failed to fetch");
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

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(value);
      window.setTimeout(() => setCopiedKey(null), 1_200);
    } catch {
      setCopiedKey(null);
    }
  }

  const taskHash = onChainReceipt?.taskHash ?? verifyData?.onChain?.taskHash ?? "";
  const rootHash = verifyData?.onChain?.rootHash ?? reportHash ?? "";
  const signedBy = onChainReceipt?.signedBy ?? verifyData?.onChain?.submitter ?? "";
  const contractAddress = onChainReceipt?.contractAddress || verifyData?.contract?.address || "";
  const txHash = onChainReceipt?.txHash ?? "";
  const txUrl = onChainReceipt?.explorerTxUrl || "";
  const contractUrl = contractExplorerUrl(contractAddress, txUrl, verifyData?.contract?.explorerUrl);
  const registryMode = onChainReceipt?.registryMode ?? verifyData?.onChain?.registryMode ?? "pending";
  const signatureVerified =
    onChainReceipt?.signatureVerified ?? verifyData?.onChain?.signatureVerified;
  const allVerified =
    Boolean(rootHash) &&
    Boolean(contractAddress) &&
    Boolean(txHash || verifyData?.verified) &&
    signatureVerified === true;

  return (
    <section className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase text-[var(--cm-text-muted)]">Integrity Receipt</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--cm-text-primary)]">
            {allVerified ? "Signed operator proof verified" : "On-chain proof pending"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cm-text-muted)]">
            EIP-712 operator signature, 0G root hash, and registry metadata for the latest report.
          </p>
        </div>
        <div className={allVerified ? "rounded-lg border border-[var(--cm-accent)]/40 bg-[var(--cm-accent)]/10 px-4 py-3 text-sm font-semibold text-teal-200" : "rounded-lg border border-[var(--cm-warning)]/40 bg-[var(--cm-warning)]/10 px-4 py-3 text-sm font-semibold text-amber-200"}>
          {allVerified ? "✓ verified" : loading ? "checking" : "needs verification"}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-[#0d0d0f] p-4">
        <ReceiptRow
          label="task hash"
          value={taskHash ? shortenHash(taskHash, 10, 6) : ""}
          copyValue={taskHash}
          copied={copiedKey === taskHash}
          onCopy={copy}
        />
        <ReceiptRow
          label="root hash"
          value={rootHash ? shortenHash(rootHash, 10, 6) : ""}
          copyValue={rootHash}
          copied={copiedKey === rootHash}
          onCopy={copy}
        />
        <ReceiptRow
          label="signed by"
          value={signedBy ? shortenHash(signedBy, 10, 4) : ""}
          copyValue={signedBy}
          verified={signatureVerified}
          copied={copiedKey === signedBy}
          onCopy={copy}
        />
        <ReceiptRow
          label="contract"
          value={contractAddress ? shortenHash(contractAddress, 10, 4) : ""}
          copyValue={contractAddress}
          actionHref={contractUrl}
          actionLabel="explorer ↗"
          copied={copiedKey === contractAddress}
          onCopy={copy}
        />
        <ReceiptRow
          label="tx"
          value={txHash ? shortenHash(txHash, 10, 6) : ""}
          copyValue={txHash}
          actionHref={txUrl}
          actionLabel="tx ↗"
          copied={copiedKey === txHash}
          onCopy={copy}
        />
        <ReceiptRow
          label="registry mode"
          value={registryMode}
          copyValue={registryMode}
          copied={copiedKey === registryMode}
          onCopy={copy}
        />
      </div>

      {verifyData?.integrityChecks ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <CheckLine label="Root hash format" value={verifyData.integrityChecks.rootHashFormat} />
          <CheckLine label="Score range" value={verifyData.integrityChecks.scoreRange} />
          <CheckLine label="Recommendation" value={verifyData.integrityChecks.validRecommendation} />
          <CheckLine label="Storage URI" value={verifyData.integrityChecks.hasStorageUri} />
          <CheckLine label="Submitter" value={verifyData.integrityChecks.hasSubmitter} />
          <CheckLine
            label="Operator signature"
            value={verifyData.integrityChecks.operatorSignatureVerified ?? signatureVerified}
          />
        </div>
      ) : null}

      {!loading && fetchError ? (
        <div className="mt-4 rounded-lg border border-[var(--cm-warning)]/40 bg-[var(--cm-warning)]/10 p-3 text-xs text-amber-200">
          Verification fetch failed: {fetchError}
        </div>
      ) : null}

      {!loading && !fetchError && verifyData?.error ? (
        <div className="mt-4 rounded-lg border border-[var(--cm-warning)]/40 bg-[var(--cm-warning)]/10 p-3 text-xs text-amber-200">
          {verifyData.error}
        </div>
      ) : null}
    </section>
  );
}
