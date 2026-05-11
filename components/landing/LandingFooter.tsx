type LandingFooterProps = {
  version: string;
  buildHash: string;
};

export function LandingFooter({ version, buildHash }: LandingFooterProps) {
  return (
    <footer className="border-t border-[var(--cm-border)]">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6 text-sm text-[var(--cm-text-muted)] sm:px-8 md:grid-cols-[1fr_auto_1fr] md:items-center lg:px-10">
        <div>
          <p className="font-mono text-[var(--cm-text-primary)]">ClawMind</p>
          <p className="mt-1 font-mono text-xs">v{version} · build {buildHash}</p>
        </div>
        <nav className="flex flex-wrap gap-4">
          <a href="https://github.com/ILYUTKICK/clawmind#readme" target="_blank" rel="noreferrer" className="transition hover:text-[var(--cm-text-primary)]">Docs</a>
          <a href="https://github.com/ILYUTKICK/clawmind" target="_blank" rel="noreferrer" className="transition hover:text-[var(--cm-text-primary)]">GitHub</a>
          <a href="https://chainscan.0g.ai/address/0x08a9c275f5d0764a32f9dda4f50ba6f9a828e2b1" target="_blank" rel="noreferrer" className="transition hover:text-[var(--cm-text-primary)]">0G mainnet</a>
          <a href="/api/openclaw/manifest" className="transition hover:text-[var(--cm-text-primary)]">OpenClaw manifest</a>
        </nav>
        <p className="font-mono text-xs md:text-right">Built for 0G APAC Hackathon · 2026</p>
      </div>
    </footer>
  );
}
