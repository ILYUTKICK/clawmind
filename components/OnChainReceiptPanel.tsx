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

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Submitter Authentication
          </p>
          {receipt.registryMode === "SIGNED_OPERATOR" ? (
            <div className="mt-2 space-y-2">
              <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                Signed operator verified by contract
              </div>
              {receipt.signedBy && (
                <p className="font-mono text-xs text-cyan-200">
                  Signed by {shortenHash(receipt.signedBy)}
                </p>
              )}
              {receipt.taskHash && (
                <p className="font-mono text-xs text-zinc-400 break-all">
                  Task hash: {receipt.taskHash}
                </p>
              )}
              {receipt.signature && (
                <p className="font-mono text-xs text-zinc-500 break-all">
                  Signature: {shortenHash(receipt.signature, 14)}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-xs text-yellow-200">
              Legacy registry mode. Deploy the signed registry to enforce EIP-712 operator authentication.
            </div>
          )}
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
