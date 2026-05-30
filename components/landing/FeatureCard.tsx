type ScoreMathVisual = {
  initialScore: number;
  highSeverity: number;
  mediumSeverity: number;
  finalScore: number;
};

type ReceiptVisual = {
  signedBy: string;
  rootHash: string;
  contract: string;
};

type MemoryVisual = {
  totalRecords: number;
  seedRecords: number;
  runtimeRecords: number;
  deduped: boolean;
};

type FeatureCardProps = {
  title: string;
  description: string;
  visualType: "score-math" | "receipt" | "memory";
  visualData: ScoreMathVisual | ReceiptVisual | MemoryVisual;
};

function truncateHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function Visual({ visualType, visualData }: Pick<FeatureCardProps, "visualType" | "visualData">) {
  if (visualType === "score-math") {
    const data = visualData as ScoreMathVisual;
    return (
      <div className="space-y-2">
        <div className="flex justify-between gap-4"><span>Initial score</span><span>{data.initialScore}</span></div>
        <div className="flex justify-between gap-4 text-red-200"><span>High severity × {data.highSeverity}</span><span>-15</span></div>
        <div className="flex justify-between gap-4 text-amber-200"><span>Medium severity × {data.mediumSeverity}</span><span>-7</span></div>
        <div className="border-t border-[var(--cm-border)] pt-2" />
        <div className="flex justify-between gap-4 text-[var(--cm-text-primary)]"><span>Final score</span><span>{data.finalScore}</span></div>
      </div>
    );
  }

  if (visualType === "receipt") {
    const data = visualData as ReceiptVisual;
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3"><span className="text-[var(--cm-text-muted)]">SIGNED BY</span><span>{truncateHash(data.signedBy)} <span className="text-[var(--cm-accent)]">✓</span></span></div>
        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3"><span className="text-[var(--cm-text-muted)]">ROOT HASH</span><span>{truncateHash(data.rootHash)}</span></div>
        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3"><span className="text-[var(--cm-text-muted)]">CONTRACT</span><span>{truncateHash(data.contract)}</span></div>
      </div>
    );
  }

  const data = visualData as MemoryVisual;
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-4"><span>MEMORY RECORDS</span><span>{data.totalRecords}</span></div>
      <div className="flex justify-between gap-4"><span>SEED PRECEDENTS</span><span>{data.seedRecords}</span></div>
      <div className="flex justify-between gap-4"><span>RUNTIME LEARNED</span><span>{data.runtimeRecords}</span></div>
      <div className="flex justify-between gap-4 text-[var(--cm-accent)]"><span>DEDUPED INDEX</span><span>{data.deduped ? "YES" : "NO"}</span></div>
    </div>
  );
}

export function FeatureCard({ title, description, visualType, visualData }: FeatureCardProps) {
  return (
    <article className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5">
      <h3 className="text-lg font-semibold text-[var(--cm-text-primary)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--cm-text-secondary)]">{description}</p>
      <div className="mt-5 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)] p-4 font-mono text-xs leading-6 text-[var(--cm-text-secondary)]">
        <Visual visualType={visualType} visualData={visualData} />
      </div>
    </article>
  );
}
