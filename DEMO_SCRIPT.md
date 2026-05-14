# ClawMind Demo Script

Target length: 3-5 minutes. Record in the browser only; do not show `.env`, Vercel settings, terminal history, or private keys.

## One-line Pitch

ClawMind runs multi-agent due diligence on Web3 projects and records each report with verifiable 0G Storage and 0G Chain receipts.

## Demo Prompt

Use a high-risk case so the Critic and score adjustment are easy to see:

```txt
Self-custodial Web3 agent that auto-trades user funds. The private key is stored in an environment variable. There are no withdrawal guards, no multisig, no circuit breaker, and no user approval step before trades.
```

## Tabs to Open Before Recording

1. `https://clawmind-puce.vercel.app`
2. `https://clawmind-puce.vercel.app/stats`
3. `https://clawmind-puce.vercel.app/analysis`
4. `https://clawmind-puce.vercel.app/judge`
5. `https://clawmind-puce.vercel.app/api/openclaw/manifest?format=json`
6. `https://chainscan.0g.ai/address/0x08a9c275f5d0764a32f9dda4f50ba6f9a828e2b1`
7. `https://clawmind-mcp.vercel.app/mcp`

## 0:00-0:25 - Product Overview

Show the landing page.

Voiceover:

> This is ClawMind, a multi-agent due diligence platform for Web3 projects. A user submits a project description, eight pipeline stages analyze it, an adversarial Critic challenges the conclusions, and the final report is stored, signed, and recorded on 0G mainnet.

Point at the primary routes:

- Run analysis: `/analysis`
- Live telemetry: `/stats`
- Judge mode: `/judge`

## 0:25-0:55 - Live 0G Evidence

Open `/stats`.

Show:

- Total on-chain analyses
- Signed registry status
- Memory records
- Latest registry entries
- MCP initiated count

Voiceover:

> This dashboard is backed by the public Judge API. It shows live 0G mainnet activity: on-chain registry entries, EIP-712 signed operator status, runtime memory growth, Critic effectiveness, and MCP usage.

If the numbers have changed, read the numbers on screen instead of hard-coding them in the narration.

## 0:55-1:15 - Start a New Analysis

Open `/analysis`, paste the demo prompt, and click `Run analysis`.

Voiceover:

> I will run a high-risk example: an agent that can auto-trade user funds with a private key in an environment variable and no withdrawal guards.

## 1:15-2:05 - Explain the 8-step Pipeline

Show the live pipeline while it runs. If it takes too long, jump cut to the completed state.

Voiceover:

> The pipeline has eight stages. Memory Retrieval searches previous analyses using semantic embeddings. Planner decomposes the task. Researcher extracts facts and assumptions. Risk Agent identifies custody, governance, operational, and economic risks. Architect proposes mitigations. Critic adversarially challenges prior conclusions. Final Synthesis produces the score and recommendation. Memory Writer appends the result back into persistent memory.

Explain 0G Compute:

> The LLM agent steps are routed through 0G Compute via the 0G Router. The production deployment currently uses the stable DeepSeek route, and the model router keeps fallback routing configurable in the codebase.

## 2:05-2:45 - Critic and Score Adjustment

Show the final report, score, recommendation, and Adversarial/Critic panel.

Voiceover:

> The Critic is not cosmetic. Each unresolved challenge changes the final score: high severity subtracts 15 points, medium subtracts 7, and low subtracts 3. In this example, custody, private-key, and missing-control issues push the recommendation toward NO_GO.

Show the score adjustment math if visible:

```txt
Initial score
High severity penalties
Medium severity penalties
Final score
```

## 2:45-3:20 - 0G Storage and Persistent Memory

Show the receipt / report URI / Memory Writer output.

Voiceover:

> The final report is persisted to 0G Storage. The receipt includes a root hash and a `0g://` URI. The Memory Writer also stores a distilled memory record, so future analyses can retrieve relevant prior context through semantic similarity.

Point at:

- `provider: 0G_STORAGE`
- `rootHash`
- `storageUri`
- memory record or memory index URI

## 3:20-3:55 - 0G Chain and EIP-712

Show the Integrity panel or on-chain receipt. Open the explorer if the link is visible.

Voiceover:

> After storage succeeds, ClawMind signs the analysis with an authorized operator using EIP-712 typed data. The AnalysisRegistry smart contract verifies that signature and records the report root hash, score, recommendation, storage URI, and operator proof on 0G Chain mainnet.

Point at:

- Signed by `0x9A0C...99F8`
- Contract `0x08a9...e2b1`
- Transaction hash or explorer link
- `SIGNED_OPERATOR`

## 3:55-4:35 - MCP as Infrastructure Surface

Open the MCP endpoint or README MCP block.

Voiceover:

> ClawMind is not only a web UI. It is also exposed as a remote MCP server, so Claude Desktop, Cursor, or any MCP-compatible client can call the same production pipeline. The MCP server is intentionally small: one tool runs due diligence, and one tool reads recent signed analyses.

Show the config:

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

Add:

> MCP calls still go through the same `/api/analyze` backend, so they get the same 0G Storage persistence, EIP-712 signing, and 0G Chain registry flow as web-initiated analyses.

## 4:35-4:55 - Judge Mode and OpenClaw Manifest

Open `/judge` and `/api/openclaw/manifest?format=json`.

Voiceover:

> For judges, ClawMind exposes a dedicated Judge Mode and an OpenClaw manifest. These show the eight-step pipeline, 0G Compute, 0G Storage, 0G Chain, semantic memory, and signed registry evidence without requiring a wallet.

Point at:

- `pipelineSteps: 8`
- `signatureVerified: true`
- `provider: 0G_COMPUTE`
- `provider: 0G_STORAGE`
- `semanticRetrievalActive: true`

## 4:55-5:10 - Close

Return to landing or `/stats`.

Voiceover:

> ClawMind is a due-diligence aid, not a replacement for human security review. The value is reproducibility: multi-agent reasoning, persistent memory, MCP access, and verifiable 0G receipts for every report.

Final frame:

```txt
Live app: https://clawmind-puce.vercel.app
Judge mode: https://clawmind-puce.vercel.app/judge
Stats: https://clawmind-puce.vercel.app/stats
MCP: https://clawmind-mcp.vercel.app/mcp
```

## Judge Q&A

### Is this a formal audit?

No. ClawMind is a due-diligence aid. It does not execute transactions, manage user funds, or replace human security review.

### Where is 0G Compute used?

The LLM agent steps call the shared 0G Compute abstraction in `lib/compute/zero-g-compute.ts`, routed through the 0G Router.

### Where is 0G Storage used?

Final reports and memory index snapshots are persisted with `0g://` URIs. The UI and `/api/judge` expose the latest report and memory receipts.

### Where is 0G Chain used?

`contracts/AnalysisRegistry.sol` records each completed analysis with the report root hash, score, recommendation, storage URI, and EIP-712 operator proof.

### Why does the manifest show one model route?

The production deployment currently uses a stable single primary 0G Compute model route. The project is multi-agent by orchestration and role separation; model routing remains configurable in `lib/compute/model-router.ts`.

### Why are there historical contract addresses?

The current production registry is v3 at `0x08a9c275f5d0764a32f9dda4f50ba6f9a828e2b1`. Earlier v1/v2 registries are preserved as hackathon history, but `/api/judge`, `/stats`, `/analysis`, and MCP use v3 only.
