import { StorageReceipt } from "@/lib/types";

// ---------------------------------------------------------------------------
// MemoryIndexReceipt — displays memory index receipt with proper labeling
// ---------------------------------------------------------------------------

type MemoryIndexReceiptProps = {
  receipt?: StorageReceipt;
};

function shortenHash(value: string, chars = 12): string {
  if (!value || value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
}

export function MemoryIndexReceipt({ receipt }: MemoryIndexReceiptProps) {
  const isReal0G = receipt?.provider === "0G_STORAGE";

  const description = isReal0G
    ? "Generated memory index was persisted through 0G Storage."
    : "Memory index stored locally. Enable 0G Storage to persist the memory index on-chain.";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Memory Index Receipt
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
          isReal0G
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
        }`}>
          {isReal0G ? "0G Storage" : "Local Fallback"}
        </span>
      </div>

      {!receipt ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
          No memory index generated yet.
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Provider
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-100">
              {receipt.provider}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Memory Index Hash
            </p>
            <p className="mt-2 break-all font-mono text-sm text-cyan-200">
              {shortenHash(receipt.reportHash)}
            </p>
            <p className="mt-1 text-xs text-zinc-600 break-all">
              Full: {receipt.reportHash}
            </p>
          </div>

          {receipt.storageUri ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Memory Index URI
              </p>
              <p className="mt-2 break-all font-mono text-sm text-zinc-300">
                {receipt.storageUri}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Created At
            </p>
            <p className="mt-2 text-sm text-zinc-300">{receipt.createdAt}</p>
          </div>

          {isReal0G && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-xs text-emerald-200">
                <span className="font-semibold">Verified on 0G Storage</span> — This memory index can be loaded by future analysis runs via the 0g:// URI.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
