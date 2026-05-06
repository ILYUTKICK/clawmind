import { StorageReceipt } from "@/lib/types";

type MemoryIndexReceiptProps = {
  receipt?: StorageReceipt;
};

export function MemoryIndexReceipt({ receipt }: MemoryIndexReceiptProps) {
  const description =
    receipt?.provider === "0G_STORAGE"
      ? "Generated memory index was persisted through 0G Storage."
      : "Memory index is waiting for the next analysis run.";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Memory Index Receipt
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
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
              {receipt.reportHash}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Memory Index URI
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-300">
              {receipt.storageUri}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Created At
            </p>
            <p className="mt-2 text-sm text-zinc-300">{receipt.createdAt}</p>
          </div>
        </div>
      )}
    </section>
  );
}