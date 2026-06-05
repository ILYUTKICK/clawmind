import Link from "next/link";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--cm-border)] bg-[rgba(10,10,11,0.86)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold tracking-normal text-[var(--cm-text-primary)]">
            ClawMind
          </span>
          <span
            className="h-2 w-2 rounded-full bg-[var(--cm-accent)] shadow-[0_0_0_4px_rgba(20,184,166,0.12)] animate-pulse"
            title="Live · 0G Mainnet"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[var(--cm-text-muted)] md:flex">
          <Link href="/stats" className="transition hover:text-[var(--cm-text-primary)]">
            Live data
          </Link>
          <a
            href="https://clawmind.mintlify.app"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[var(--cm-text-primary)]"
          >
            Docs
          </a>
          <a
            href="https://github.com/ILYUTKICK/clawmind"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[var(--cm-text-primary)]"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#mcp"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--cm-text-secondary)] transition hover:text-[var(--cm-text-primary)] sm:inline-flex"
          >
            MCP integration
          </a>
          <Link
            href="/analysis"
            className="rounded-lg bg-[var(--cm-accent)] px-3 py-2 text-sm font-medium text-black transition hover:bg-teal-300"
          >
            Run analysis →
          </Link>
        </div>
      </div>
    </header>
  );
}
