# ClawMind MCP Server

Remote MCP access for ClawMind: run the existing multi-agent Web3 analysis pipeline and read recent signed on-chain reports from MCP-compatible clients.

## Live Endpoint

Live deployment:

```text
https://clawmind-mcp.vercel.app/api/mcp
```

Root aliases are also available for clients or demos that expect shorter MCP paths:

```text
https://clawmind-mcp.vercel.app/mcp
https://clawmind-mcp.vercel.app/api/sse
https://clawmind-mcp.vercel.app/sse
```

## Environment

```bash
CLAWMIND_API_BASE_URL=https://clawmind-puce.vercel.app
KV_REDIS_URL=redis://default:...@...
```

`CLAWMIND_API_BASE_URL` points to the main ClawMind app. `KV_REDIS_URL` or `REDIS_URL` is used for MCP rate limiting and is required for `/sse`; `/mcp` and `/api/mcp` can still run locally without Redis by using an in-memory development limiter.

## Client Config

Claude Desktop with Streamable HTTP:

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

SSE-style config, if your client expects the older transport:

```json
{
  "mcpServers": {
    "clawmind": {
      "url": "https://clawmind-mcp.vercel.app/sse",
      "headers": {
        "X-MCP-Client-Id": "demo-client"
      }
    }
  }
}
```

Note: `/sse` requires `KV_REDIS_URL` or `REDIS_URL` on the MCP deployment. Prefer `/mcp` for Claude Desktop and Cursor when Streamable HTTP is supported.

Claude Desktop fallback through `mcp-remote`:

```json
{
  "mcpServers": {
    "clawmind": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://clawmind-mcp.vercel.app/api/mcp",
        "--header",
        "X-MCP-Client-Id: demo-client"
      ]
    }
  }
}
```

Cursor:

```json
{
  "mcpServers": {
    "clawmind": {
      "url": "https://clawmind-mcp.vercel.app/api/mcp",
      "headers": {
        "X-MCP-Client-Id": "demo-client"
      }
    }
  }
}
```

## Tools

### `analyze_web3_project`

Input:

```json
{
  "task": "Audit a mature Uniswap V3 fork with two independent audits, no oracle dependency, and guarded admin controls."
}
```

Output:

```json
{
  "score": 81,
  "recommendation": "GO",
  "reportUri": "0g://...",
  "taskHash": "0x...",
  "rootHash": "0x...",
  "txHash": "0x...",
  "signatureVerified": true,
  "explorerUrl": "https://chainscan.0g.ai/tx/0x..."
}
```

### `get_recent_analyses`

Input:

```json
{
  "limit": 5
}
```

Output:

```json
[
  {
    "analysisId": 15,
    "score": 0,
    "recommendation": "NO_GO",
    "timestamp": 1778505572,
    "explorerUrl": "https://chainscan.0g.ai/address/0x08a9..."
  }
]
```

## Safeguard

Every request must include `X-MCP-Client-Id`. Tool calls are rate-limited to one call per 60 seconds per client id and return `429 Too Many Requests` with `Retry-After` when throttled.
