import { StorageReceipt } from "@/lib/types";

type SystemStatusProps = {
  receipt?: StorageReceipt;
  hasPersistentMemories: boolean;
};

type StatusItem = {
  label: string;
  value: string;
  active: boolean;
};

function StatusBadge({ item }: { item: StatusItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {item.label}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-100">{item.value}</p>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            item.active
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-amber-400/30 bg-amber-400/10 text-amber-200"
          }`}
        >
          {item.active ? "Active" : "Fallback"}
        </span>
      </div>
    </div>
  );
}

export function SystemStatus({
  receipt,
  hasPersistentMemories,
}: SystemStatusProps) {
  const storageIsActive = receipt?.provider === "0G_STORAGE";
  const retrievalIsEnabled = Boolean(receipt?.storageUri?.startsWith("0g://"));

  const items: StatusItem[] = [
    {
      label: "0G Compute",
      value: "Agent inference layer",
      active: true,
    },
    {
      label: "0G Storage",
      value: storageIsActive ? "Report persistence" : "Local fallback",
      active: storageIsActive,
    },
    {
      label: "Memory",
      value: hasPersistentMemories ? "Persistent context" : "Ready",
      active: hasPersistentMemories,
    },
    {
      label: "Retrieval",
      value: retrievalIsEnabled ? "Root hash retrieval" : "Waiting for receipt",
      active: retrievalIsEnabled,
    },
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">System Status</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Live infrastructure status for the ClawMind agentic pipeline.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <StatusBadge key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}