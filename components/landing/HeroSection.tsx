import Link from "next/link";
import type { LandingCta } from "./types";

type HeroSectionProps = {
  headline: string;
  subhead: string;
  eyebrow: string;
  primaryCta: LandingCta;
  secondaryCta: LandingCta;
};

export function HeroSection({
  headline,
  subhead,
  eyebrow,
  primaryCta,
  secondaryCta,
}: HeroSectionProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-16 pt-20 text-center sm:px-8 sm:pb-20 sm:pt-28 lg:px-10">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--cm-text-muted)]">
        {eyebrow}
      </p>
      <h1 className="mt-6 max-w-5xl text-4xl font-semibold leading-[1.04] tracking-normal text-[var(--cm-text-primary)] sm:text-6xl lg:text-7xl">
        {headline}
      </h1>
      <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--cm-text-secondary)] sm:text-lg">
        {subhead}
      </p>
      <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
        <Link
          href={primaryCta.href}
          className="rounded-lg bg-[var(--cm-accent)] px-5 py-3 text-sm font-medium text-black transition hover:bg-teal-300"
        >
          {primaryCta.label}
        </Link>
        <Link
          href={secondaryCta.href}
          className="rounded-lg border border-[var(--cm-border-emphasis)] px-5 py-3 text-sm font-medium text-[var(--cm-text-primary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
        >
          {secondaryCta.label}
        </Link>
      </div>
      <p className="mt-5 font-mono text-xs text-[var(--cm-text-muted)]">
        8 agents · ~30s per analysis · ~$0.03 cost · signed and recorded on 0G
      </p>
    </section>
  );
}

