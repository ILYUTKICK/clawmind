import { OnChainReceipt } from "@/lib/types";

// ---------------------------------------------------------------------------
// OnChainReceiptPanel — displays on-chain registration evidence
// ---------------------------------------------------------------------------

type OnChainReceiptPanelProps = {
  receipt: OnChainReceipt;
};

function shortenHash(value: string, chars = 10): string {
  if (!value || value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
}

export function OnChainReceiptPanel({ receipt }: OnChainReceiptPanelProps) {
  if (receipt.provider === "NOT_CONFIGURED") {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          On-Chain Registration Receipt
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          This analysis was anchored on the 0G chain through the AnalysisRegistry contract.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Contract Address
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="font-mono text-sm text-cyan-200">
              {shortenHash(receipt.contractAddress)}
            </p>
            {receipt.explorerTxUrl && (
              <a
                href={receipt.explorerTxUrl.replace(/\/tx\/.*$/, `/address/${receipt.contractAddress}`)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-300 underline decoration-purple-400/40 underline-offset-4 hover:text-purple-200"
              >
                View on Explorer
              </a>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Transaction Hash
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="font-mono text-sm text-cyan-200">
              {shortenHash(receipt.txHash)}
            </p>
            {receipt.explorerTxUrl && (
              <a
                href={receipt.explorerTxUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-300 underline decoration-purple-400/40 underline-offset-4 hover:text-purple-200"
              >
                View Tx on Explorer
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Analysis ID
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              #{receipt.analysisId}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Block Number
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {receipt.blockNumber}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <p className="text-xs text-emerald-200">
            <span className="font-semibold">0G Chain</span> — This record is permanently stored on-chain and can be independently verified through the 0G Explorer.
          </p>
        </div>
      </div>
    </section>
  );
}
