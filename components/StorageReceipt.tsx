import { StorageReceipt as StorageReceiptType } from "@/lib/types";

type StorageReceiptProps = {
  receipt?: StorageReceiptType;
};

export function StorageReceipt({ receipt }: StorageReceiptProps) {
  const description =
    receipt?.provider === "0G_STORAGE"
      ? "This report was persisted through 0G Storage and can be referenced by its storage URI."
      : "MVP receipt uses local fallback. Enable 0G Storage to persist reports on decentralized storage.";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Decision Receipt
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>

      {!receipt ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
          No receipt generated yet.
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
              Report Hash
            </p>
            <p className="mt-2 break-all font-mono text-sm text-cyan-200">
              {receipt.reportHash}
            </p>
          </div>

          {receipt.storageUri ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Storage URI
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
        </div>
      )}
    </section>
  );
}