"use client";

import { useMemo, useState } from "react";

type McpIntegrationBlockProps = {
  endpointUrl: string;
  clientIdExample: string;
};

export function McpIntegrationBlock({
  endpointUrl,
  clientIdExample,
}: McpIntegrationBlockProps) {
  const [copied, setCopied] = useState(false);
  const config = useMemo(
    () => JSON.stringify(
      {
        mcpServers: {
          clawmind: {
            url: endpointUrl,
            headers: {
              "X-MCP-Client-Id": clientIdExample,
            },
          },
        },
      },
      null,
      2,
    ),
    [clientIdExample, endpointUrl],
  );

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="mcp" className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-10">
      <div className="flex flex-col justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--cm-text-muted)]">
          MCP integration
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--cm-text-primary)] sm:text-3xl">
          Works in Claude Desktop, Cursor, and any MCP client
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--cm-text-secondary)]">
          ClawMind exposes its full pipeline as an MCP server. Two tools:
          analyze_web3_project and get_recent_analyses. Authentication uses the
          X-MCP-Client-Id header and each client is rate-limited.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://github.com/ILYUTKICK/clawmind#remote-mcp-server"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[var(--cm-border-emphasis)] px-4 py-2 text-sm text-[var(--cm-text-primary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
          >
            Integration docs ↗
          </a>
          <a
            href="https://clawmind-mcp.vercel.app/mcp"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[var(--cm-border-emphasis)] px-4 py-2 text-sm text-[var(--cm-text-primary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
          >
            MCP endpoint ↗
          </a>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-[var(--cm-border)] bg-[var(--cm-background)]">
        <div className="flex items-center justify-between border-b border-[var(--cm-border)] px-4 py-3">
          <span className="font-mono text-xs text-[var(--cm-text-muted)]">claude_desktop_config.json</span>
          <button
            type="button"
            onClick={copyConfig}
            className="rounded-md border border-[var(--cm-border)] px-2 py-1 font-mono text-xs text-[var(--cm-text-secondary)] transition hover:border-[var(--cm-accent)] hover:text-teal-200"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-xs leading-6 text-[var(--cm-text-secondary)] sm:text-sm">
          <code>{config}</code>
        </pre>
      </div>
    </section>
  );
}

