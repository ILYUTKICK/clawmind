# ClawMind

**Persistent multi-agent cognitive backbone for autonomous Web3 decision-making, powered by 0G Compute and 0G Storage.**

ClawMind is an agentic infrastructure project built for **0G APAC Track 1: Agentic Infrastructure & OpenClaw Lab**.

It is not a chatbot. It is a modular multi-agent decision engine that plans, analyzes, critiques, stores, and reuses decision context across runs.

---

## Track Fit

Track 1 focuses on:

- cognitive backbone for autonomous intelligence
- orchestration layers
- agent frameworks
- specialized Skills
- data-processing pipelines
- 0G Compute for model inference
- 0G Storage for state persistence and long-context memory

ClawMind directly targets these requirements.

### Cognitive Backbone

ClawMind uses a structured multi-agent pipeline:

```txt
Memory Retrieval
→ Planner Agent
→ Research Agent
→ Risk Agent
→ Architect Agent
→ Critic Agent
→ Final Decision Agent
→ Memory Writer
```

Each agent has a specialized role and contributes to a final structured decision report.

### Orchestration Layer

The orchestration layer is implemented in:

```txt
lib/orchestrator/run-analysis.ts
```

It controls agent execution order, passes context between agents, collects outputs, generates reports, and writes receipts.

### Specialized Agent Skills

ClawMind includes specialized agent modules:

```txt
lib/agents/planner.ts
lib/agents/researcher.ts
lib/agents/risk-agent.ts
lib/agents/architect.ts
lib/agents/critic.ts
lib/agents/final-agent.ts
```

Current skills include:

- planning
- research extraction
- risk analysis
- architecture design
- critical review
- final decision synthesis
- memory writing

### 0G Compute

ClawMind uses a compute abstraction layer:

```txt
lib/compute/zero-g-compute.ts
```

Agents call a shared `runInference()` function, which supports:

- 0G Compute / 0G Router OpenAI-compatible endpoint
- local fallback inference for demo reliability

Environment variables:

```env
ZERO_G_COMPUTE_ENDPOINT=https://router-api.0g.ai/v1/chat/completions
ZERO_G_COMPUTE_API_KEY=your_0g_router_api_key
ZERO_G_COMPUTE_MODEL=your_0g_model
```

### 0G Storage

ClawMind stores final analysis reports in 0G Storage through:

```txt
lib/storage/zero-g-storage.ts
```

When enabled, the Decision Receipt displays:

```txt
Provider: 0G_STORAGE
Report Hash: 0x...
Storage URI: 0g://...
```

Environment variables:

```env
ZERO_G_STORAGE_ENABLED=true
ZERO_G_STORAGE_PRIVATE_KEY=your_testnet_wallet_private_key
ZERO_G_STORAGE_EVM_RPC=https://evmrpc-testnet.0g.ai
ZERO_G_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
```

Use a burner wallet with testnet tokens only.

---

## Problem

Web3 builders, analysts, and founders often evaluate projects using fragmented information:

- whitepapers
- GitHub repositories
- protocol docs
- tokenomics
- risk assumptions
- previous research
- security concerns

Normal LLM chats are stateless. Every analysis starts from zero.

ClawMind solves this by creating a persistent agentic decision layer that can:

- structure messy project information
- identify risks
- propose architecture
- critique assumptions
- generate a decision report
- store results in 0G Storage
- reuse prior memory in future analysis

---

## Demo Use Case

Input:

```txt
Analyze this Web3 AI protocol idea:
An autonomous DeFi agent manages user funds across multiple yield protocols,
uses LLM reasoning to rebalance positions, and optimizes APY while storing
decisions in decentralized infrastructure.
```

ClawMind returns:

- relevant memories used
- agent pipeline execution
- risk map
- architecture recommendations
- opportunity analysis
- final score
- recommendation
- 0G Storage decision receipt

Example recommendation:

```txt
INVESTIGATE_MORE
```

---

## Architecture

```txt
Frontend UI
   ↓
Next.js API Route
   ↓
Agent Orchestrator
   ↓
Memory Manager
   ↓
Agent Pipeline
   ├─ Planner Agent
   ├─ Research Agent
   ├─ Risk Agent
   ├─ Architect Agent
   ├─ Critic Agent
   └─ Final Decision Agent
   ↓
0G Compute
   ↓
0G Storage
   ↓
Decision Receipt
```

---

## Repository Structure

```txt
clawmind/
  app/
    api/
      analyze/
        route.ts
      memory/
        route.ts
    globals.css
    layout.tsx
    page.tsx

  components/
    AgentPipeline.tsx
    InputForm.tsx
    MemoryPanel.tsx
    ReportView.tsx
    StorageReceipt.tsx

  lib/
    agents/
      architect.ts
      critic.ts
      final-agent.ts
      planner.ts
      researcher.ts
      risk-agent.ts

    compute/
      compute-status.ts
      zero-g-compute.ts

    demo/
      mock-analysis.ts
      mock-memory.ts

    memory/
      memory-manager.ts

    orchestrator/
      run-analysis.ts

    storage/
      storage-receipt.ts
      zero-g-storage.ts

    types.ts
```

---

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- 0G Compute / 0G Router
- 0G Storage TypeScript SDK
- ethers

---

## Getting Started

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Build:

```bash
npm run build
```

---

## Environment Variables

Create `.env.local`:

```env
ZERO_G_COMPUTE_ENDPOINT=https://router-api.0g.ai/v1/chat/completions
ZERO_G_COMPUTE_API_KEY=your_0g_router_api_key
ZERO_G_COMPUTE_MODEL=your_0g_model

ZERO_G_STORAGE_ENABLED=false
ZERO_G_STORAGE_PRIVATE_KEY=your_testnet_wallet_private_key
ZERO_G_STORAGE_EVM_RPC=https://evmrpc-testnet.0g.ai
ZERO_G_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
```

For real 0G Storage upload:

```env
ZERO_G_STORAGE_ENABLED=true
```

Use a testnet burner wallet only.

---

## Deployment Notes

ClawMind can be deployed to Vercel as a Next.js application.

Required production environment variables:

```env
ZERO_G_COMPUTE_ENDPOINT=https://router-api.0g.ai/v1/chat/completions
ZERO_G_COMPUTE_API_KEY=your_0g_router_api_key
ZERO_G_COMPUTE_MODEL=your_0g_model

ZERO_G_STORAGE_ENABLED=true
ZERO_G_STORAGE_PRIVATE_KEY=your_testnet_burner_wallet_private_key
ZERO_G_STORAGE_EVM_RPC=https://evmrpc-testnet.0g.ai
ZERO_G_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai

Security notes:

Do not deploy with a main wallet private key.
Use a burner wallet with testnet funds only.
Never commit .env.local.
Keep .env.example public and secret-free.
If 0G Storage is disabled, ClawMind falls back to local receipt mode.

Production check flow:

Run analysis.
Confirm 0G Compute agent execution.
Confirm Provider: 0G_STORAGE.
Copy the Storage URI.
Retrieve the report through the retrieval panel.
Confirm persistent memory appears in later analysis runs.

---

## Current Features

- Multi-agent analysis pipeline
- Agent orchestration layer
- 0G Compute-compatible inference abstraction
- 0G Storage report persistence
- Decision receipt with report hash and storage URI
- Relevant memory panel
- Structured final report
- Risk map
- Architecture recommendations
- Local fallback mode for stable demos

---

## Version History

```txt
ClawMind v0.4
├─ UI working
├─ API routes working
├─ Agent Orchestrator working
├─ 0G Compute connected
├─ 0G Storage connected
├─ Persistent report upload working
├─ Decision Receipt working
└─ Production build passing
```


### v0.5.0 — MVP with 0G Compute and 0G Storage

- Built the initial ClawMind MVP
- Added multi-agent UI
- Added agent pipeline
- Added 0G Compute integration
- Added 0G Storage report persistence
- Added README and demo script

### v0.6.0 — Real Memory Persistence

- Added generated memory records
- Persisted memory records locally
- Reused generated memories in future analysis runs
- Updated `/api/memory` to return persistent memories

### v0.7.0 — 0G Report Retrieval

- Added report retrieval by 0G root hash
- Added `/api/report/retrieve`
- Added retrieval UI panel
- Enabled verification of stored reports through 0G Storage

### v0.8.0 — Demo Polish and Track Fit Panel

- Added System Status panel
- Added Track 1 Fit panel
- Improved demo readability
- Highlighted 0G Compute, 0G Storage, memory, and retrieval status

### v0.9.0 — Deployment Readiness

- Added `.env.example`
- Added deployment notes
- Prepared project for public demo deployment

## Roadmap

### Completed

- UI skeleton
- Mock API
- Agent Orchestrator v0.1
- Compute abstraction layer
- 0G Compute integration
- 0G Storage integration
- Decision Receipt
- Production build

### Next

- Real memory persistence
- Store generated memory records in 0G Storage
- Retrieve previous memory records across runs
- Add report retrieval by 0G root hash
- Improve OpenClaw-compatible orchestration metadata
- Add document and URL analysis
- Deploy demo

---

## Why ClawMind Matters

Autonomous AI systems need more than single-turn answers.

They need:

- persistent state
- reusable memory
- specialized reasoning modules
- verifiable outputs
- decentralized storage
- reliable compute infrastructure

ClawMind is an early prototype of this infrastructure layer for Web3-native autonomous intelligence.