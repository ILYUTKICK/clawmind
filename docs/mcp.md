# MCP Integration

ClawMind exposes a remote Model Context Protocol server so MCP-compatible clients can call the same analysis functionality used by the web application.

## Endpoint

```text
https://clawmind-mcp.vercel.app/mcp
```

## Client Header

Requests require a client identifier:

```text
X-MCP-Client-Id
```

The MCP surface is rate-limited per client.

---

## Example Configuration

```json
{
  "mcpServers": {
    "clawmind": {
      "url": "https://clawmind-mcp.vercel.app/mcp",
      "headers": {
        "X-MCP-Client-Id": "demo-client"
      }
    }
  }
}
```

---

## Tools

### `analyze_web3_project(task)`

Runs the ClawMind analysis workflow.

Conceptually:

```text
MCP Client
   |
   v
analyze_web3_project
   |
   v
ClawMind Analysis Pipeline
   |
   v
Structured Decision + Verification Data
```

The same reasoning system is used rather than maintaining a separate MCP-only analysis implementation.

### `get_recent_analyses(limit)`

Reads recent analysis data exposed by the public verification surface.

Useful for:

- reviewing recent signed analyses;
- inspecting prior decisions;
- building client-side context around ClawMind runs.

---

## Why MCP Matters

The MCP server turns ClawMind into a reusable AI capability rather than only a standalone website.

Potential clients include:

- desktop AI assistants;
- IDE agents;
- agent orchestrators;
- internal developer tools;
- other MCP-compatible applications.

---

## Development Checks

The root repository defines separate MCP quality gates:

```bash
npm run lint:mcp
npm run typecheck:mcp
npm run build:mcp
```

Combined:

```bash
npm run ci:mcp
```

---

## Design Notes

1. Keep MCP tool behavior aligned with the web/API pipeline.
2. Avoid returning secrets or internal configuration.
3. Keep tool schemas stable.
4. Treat rate limits as part of the public interface.
5. Add MCP-specific regression tests when tool contracts change.
