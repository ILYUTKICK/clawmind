<p align="center">
  <img src="https://img.shields.io/badge/Track-1%20Agentic%20Infrastructure%20%26%20OpenClaw%20Lab-orange" alt="Track 1" />
  <img src="https://img.shields.io/badge/Network-0G%20Mainnet-brightgreen" alt="Mainnet" />
  <img src="https://img.shields.io/badge/Chain_ID-16661-blue" alt="Chain ID" />
  <img src="https://img.shields.io/badge/Contract-Verified-success" alt="Verified" />
  <img src="https://img.shields.io/badge/Agents-8%20Step%20Pipeline-purple" alt="8 Agents" />
  <img src="https://img.shields.io/badge/Storage-0G%20Storage-cyan" alt="0G Storage" />
  <img src="https://img.shields.io/badge/Integrity-On--Chain%20Verified-emerald" alt="Integrity" />
</p>

<h1 align="center">🧠 ClawMind</h1>

<p align="center"><strong>Persistent multi-agent cognitive backbone for autonomous Web3 decision-making</strong></p>

<p align="center">
  <strong>0G Compute</strong> powers 8 specialized agents · <strong>0G Storage</strong> persists reports & memory · <strong>0G Chain</strong> anchors every analysis on-chain
</p>

<p align="center">
  <a href="https://clawmind-puce.vercel.app">🌐 Live App</a> ·
  <a href="https://clawmind-puce.vercel.app/judge">⚖️ Judge Mode</a> ·
  <a href="https://clawmind-puce.vercel.app/api/judge">📊 Judge API</a> ·
  <a href="https://clawmind-puce.vercel.app/api/openclaw/manifest?format=json">📋 OpenClaw Manifest</a>
</p>

---

## 🏆 TL;DR for Judges

> **3 sentences, 0 ambiguity:**

ClawMind is an 8-step multi-agent analysis system where **every agent runs on 0G Compute**, **every report is persisted to 0G Storage**, and **every analysis is anchored on 0G Chain** via a verified smart contract. The adversarial Critic Agent challenges assumptions from 4 other agents, and the Integrity Verification layer proves on-chain that report hashes match — zero tampering possible. Judge Mode provides a **zero-setup read-only review surface** with all 0G evidence in one page.

| Verifiable Claim | Live Proof |
|---|---|
| Contract on 0G Mainnet (Chain 16661) | [🔍 0x8d53...b8c7 on Explorer](https://chainscan.0g.ai/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7) |
| 0G Compute active (deepseek-chat-v3-0324) | [📊 Judge API → compute.active: true](https://clawmind-puce.vercel.app/api/judge) |
| 0G Storage persists reports & memory | In-app: Decision Receipt → `provider: "0G_STORAGE"` + `0g://` URI |
| On-chain hash matches report hash | In-app: Integrity Verification → "VERIFIED" |
| OpenClaw manifest with live 0G evidence | [📋 Manifest (JSON)](https://clawmind-puce.vercel.app/api/openclaw/manifest?format=json) |

---

## ✅ Verification Checklist for Judges

> **Scan this first.** Every claim is verifiable through live endpoints or on-chain evidence.

| # | What to Verify | How | Link |
|---|---|---|---|
| 1 | Contract deployed on 0G Mainnet | Open Explorer, verify address + Chain ID 16661 | [🔍 View on 0G Explorer](https://chainscan.0g.ai/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7) |
| 2 | On-chain transactions exist | Check contract activity tab | [🔍 Contract Activity](https://chainscan.0g.ai/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7) |
| 3 | Judge Mode shows all 0G evidence | Open `/judge`, see compute/storage/chain/OpenClaw status | [⚖️ Judge Mode](https://clawmind-puce.vercel.app/judge) |
| 4 | Judge API returns structured proof | `GET /api/judge` → JSON with all 0G evidence | [📊 Judge API](https://clawmind-puce.vercel.app/api/judge) |
| 5 | OpenClaw manifest is live | Open manifest endpoint | [📋 Manifest (YAML)](https://clawmind-puce.vercel.app/api/openclaw/manifest) |
| 6 | OpenClaw manifest with live 0G evidence | Add `?format=json` for real-time proof | [📋 Manifest (JSON)](https://clawmind-puce.vercel.app/api/openclaw/manifest?format=json) |
| 7 | Debug API shows full config | `GET /api/debug` → diagnostics | [🔧 Debug API](https://clawmind-puce.vercel.app/api/debug) |
| 8 | Run an analysis end-to-end | Submit a task on main page, watch 8-agent pipeline | [🌐 Live App](https://clawmind-puce.vercel.app) |
| 9 | Report persisted to 0G Storage | After analysis, check Decision Receipt for `0G_STORAGE` + `0g://` URI | In-app panel |
| 10 | Integrity verification passes | After analysis, check Integrity Panel → "VERIFIED" | In-app panel |
| 11 | Adversarial review works | After analysis, Critic challenges are visible | In-app: Adversarial Panel |

---

## 🔗 0G Integration — Full Stack

> **This is not a partial integration.** Every 0G component is used in the primary path — not just for show, but as the backbone of the system.

| 0G Component | Integration Point | What It Does | Proof |
|---|---|---|---|
| **0G Compute** | [`lib/compute/zero-g-compute.ts`](lib/compute/zero-g-compute.ts) | All 8 agents route inference through 0G Router — `deepseek/deepseek-chat-v3-0324` on mainnet | Judge API → `compute.active: true` |
| **0G Storage (Reports)** | [`lib/storage/zero-g-storage.ts`](lib/storage/zero-g-storage.ts) | Persists analysis reports as JSON — returns root hash + `0g://` URI | Decision Receipt → `provider: "0G_STORAGE"` |
| **0G Storage (Memory Index)** | [`lib/storage/zero-g-memory-index.ts`](lib/storage/zero-g-memory-index.ts) | Persists memory index — returns root hash + `0g://` URI | Memory Index Receipt → `provider: "0G_STORAGE"` |
| **0G Storage (Retrieval)** | [`lib/storage/zero-g-retrieval.ts`](lib/storage/zero-g-retrieval.ts) | Retrieves stored reports by `0g://` URI or root hash via 0G indexer | In-app: Retrieve Report panel |
| **0G Chain (AnalysisRegistry.sol)** | [`contracts/AnalysisRegistry.sol`](contracts/AnalysisRegistry.sol) · [`lib/contracts/analysis-registry.ts`](lib/contracts/analysis-registry.ts) | Anchors every analysis on-chain — emits `AnalysisRecorded` event | [🔍 Contract on Explorer](https://chainscan.0g.ai/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7) |
| **0G Shared Config** | [`lib/storage/zero-g-config.ts`](lib/storage/zero-g-config.ts) | Unified mainnet/testnet switching — RPC, Explorer, Chain ID auto-resolved | `ZERO_G_NETWORK=mainnet` |
| **OpenClaw Manifest** | [`openclaw.yaml`](openclaw.yaml) · [`/api/openclaw/manifest`](/api/openclaw/manifest) | Full orchestration manifest with 0G compute, storage, chain, and pipeline spec | [📋 Live Manifest](https://clawmind-puce.vercel.app/api/openclaw/manifest) |

---

## 🏛️ Mainnet Artifacts

> **On-chain proof of deployment.** This is what prevents disqualification.

| Artifact | Value | Explorer |
|---|---|---|
| **AnalysisRegistry.sol** | `0x8d53153a8a25c81701954eed66154b3ebba8b8c7` | [🔍 View Contract](https://chainscan.0g.ai/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7) |
| **Network** | 0G Mainnet (Chain ID: **16661**) | [🔗 0G Explorer](https://chainscan.0g.ai) |
| **Compute Model** | `deepseek/deepseek-chat-v3-0324` via 0G Router | Verified in Judge API |
| **Storage Indexer** | `https://indexer-storage-turbo.0g.ai` (Mainnet Turbo) | Used for upload + retrieval |
| **EVM RPC** | `https://evmrpc.0g.ai` | Mainnet RPC endpoint |
| **Report Storage tx** | *(generated after analysis run)* | *(available in Decision Receipt + Judge Mode)* |
| **Memory Index tx** | *(generated after analysis run)* | *(available in Memory Index Receipt)* |
| **On-chain registration tx** | *(generated after analysis run)* | [🔍 Contract Activity](https://chainscan.0g.ai/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7) |
| **Storage URIs** | `0g://...` *(generated after analysis run)* | *(available in receipts + Judge Mode)* |

> 💡 **Run an analysis on the [live app](https://clawmind-puce.vercel.app) to generate real tx hashes and `0g://` URIs.** They appear in the UI receipts and Judge Mode immediately.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ClawMind Architecture                        │
│                                                                       │
│  ┌──────────┐     ┌────────────────┐     ┌────────────────────────┐  │
│  │   User   │────▶│  Next.js API   │────▶│    Orchestrator        │  │
│  │  Input   │     │  /api/analyze  │     │  run-analysis.ts       │  │
│  └──────────┘     └────────────────┘     └──────────┬─────────────┘  │
│                                                       │               │
│  ┌────────────────────────────────────────────────────▼────────────┐ │
│  │                    8-Step Agent Pipeline                         │ │
│  │                                                                  │ │
│  │  ┌─────────┐   ┌────────┐   ┌────────────┐   ┌───────────┐    │ │
│  │  │ Memory  │──▶│Planner │──▶│ Researcher │──▶│Risk Agent │    │ │
│  │  │ Retrieve│   │        │   │            │   │           │    │ │
│  │  └─────────┘   └────────┘   └────────────┘   └─────┬─────┘    │ │
│  │                                                  │            │ │
│  │  ┌───────────┐   ┌────────┐   ┌──────────┐      │            │ │
│  │  │  Memory   │◀──│ Final  │◀──│  Critic  │◀─────┤            │ │
│  │  │  Writer   │   │ Agent  │   │(adversar.)│      │            │ │
│  │  └─────┬─────┘   └────────┘   └────▲─────┘      │            │ │
│  │        │                           │       ┌─────┴─────┐      │ │
│  │        │                           └───────│ Architect │      │ │
│  │        │                                   └───────────┘      │ │
│  │        │                                                      │ │
│  │  ┌─────▼──────────────────────────────────────────────────────┐ │ │
│  │  │              0G Compute (deepseek-chat-v3-0324)            │ │ │
│  │  │         https://router-api.0g.ai/v1/chat/completions      │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └──────────┬──────────────────────────────────┬──────────────────┘ │
│             │                                  │                     │
│  ┌──────────▼──────────┐           ┌──────────▼──────────────────┐  │
│  │     0G Storage       │           │        0G Chain             │  │
│  │  ┌────────────────┐  │           │  ┌────────────────────────┐ │  │
│  │  │ Report (0g://)  │  │           │  │  AnalysisRegistry.sol  │ │  │
│  │  │ Memory Index   │  │           │  │  recordAnalysis()      │ │  │
│  │  │ Retrieval API  │  │           │  │  AnalysisRecorded()    │ │  │
│  │  └────────────────┘  │           │  │  hashToAnalysisId()    │ │  │
│  │  Indexer: turbo.0g.ai│           │  └────────────────────────┘ │  │
│  └──────────────────────┘           │  Explorer: chainscan.0g.ai │  │
│                                      └────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Integrity Verification                      │  │
│  │  Report Hash ──▶ 0G Storage ──▶ 0G Chain ──▶ Hashes Match?   │  │
│  │                                              ──▶ VERIFIED ✓   │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Agent Pipeline — 8 Specialized Agents

Each agent has a narrow role, making the pipeline auditable, debuggable, and adversarial. All powered by 0G Compute.

| Step | Agent | Skill | Input → Output |
|---:|---|---|---|
| 1 | **Memory Retrieval** | `persistent-memory-retrieval` | Task → Relevant memory context from 0G Storage |
| 2 | **Planner** | `task-decomposition` | Task + memories → Execution plan |
| 3 | **Researcher** | `research-extraction` | Plan → Research findings & assumptions |
| 4 | **Risk Agent** | `web3-risk-analysis` | Research → Risk map (custody, oracle, key exposure…) |
| 5 | **Architect** | `architecture-design` | Risks → Safer architecture proposals |
| 6 | **Critic** ⚔️ | `adversarial-review` | All agent outputs → Critical challenges |
| 7 | **Final Agent** | `decision-synthesis` | All context → `MODEL_JSON` report (score, recommendation) |
| 8 | **Memory Writer** | `persistent-memory-writing` | Report → New memory + 0G Storage index |

### Data Flow Between Agents

```
Memory ──(persistent memory)──▶ Planner ──(execution plan)──▶ Researcher
    ──(research)──▶ Risk ──(risk map)──┬──▶ Architect ──(architecture)──┐
                                       │                                │
                                       └────────────────────────────────┘
                                                                        │
                                        Critic ◀────(all outputs)───────┘
                                          │
                                    (critique)
                                          │
                                   Final Agent ──(decision report)──▶ Memory Writer
                                                                      │
                                                          0G Storage (0g://)
                                                          0G Chain (tx hash)
```

---

## ⚔️ Adversarial Review — Critic Agent in Action

The Critic Agent is the heart of ClawMind's quality assurance. It **does not just summarize** — it **actively challenges** assumptions from Planner, Researcher, Risk Agent, and Architect.

### How It Works

```
┌──────────────┐     ┌──────────────┐
│  Agent Claim  │────▶│   Critic     │
│  "Risk is low"│     │  Challenge:  │
│               │     │  "What about │
│               │     │  oracle      │
│               │     │  manipulation│
│               │     │  risk?"      │
└──────────────┘     └──────┬───────┘
                             │
                    ┌────────▼────────┐
                    │  Final Agent    │
                    │  Reconciliation │
                    │  "RESOLVED"     │
                    └─────────────────┘
```

1. **Agent Claims** — Each agent produces output (plan, research, risks, architecture)
2. **Critic Challenges** — Critic identifies weaknesses, missing safeguards, blind spots
3. **Final Agent Reconciliation** — Resolves challenges into a final synthesis

This adversarial loop ensures the final report isn't an echo chamber — it's a stress-tested decision.

### In-App Evidence

After running an analysis, the **Adversarial Panel** shows:
- Agent Claims with color-coded cards
- Critic Challenges with `CHALLENGED` badges
- Final Agent Reconciliation with `RESOLVED` badges
- Challenge → Resolution flow visualization

---

## 🔒 Integrity Verification — On-Chain Proof

Every analysis goes through a 4-step integrity verification chain that proves the report data has **not been tampered with**.

```
 Step 1          Step 2              Step 3              Step 4
 ┌─────────┐    ┌──────────┐       ┌──────────┐       ┌──────────┐
 │ Report  │───▶│ Hash     │──────▶│ Hashes   │──────▶│ Explorer │
 │ stored  │    │registered│       │ match?   │       │ verified │
 │ on 0G   │    │ on 0G    │       │          │       │          │
 │ Storage │    │ Chain    │       │ ✓ MATCH  │       │ ✓ VERIF. │
 └─────────┘    └──────────┘       └──────────┘       └──────────┘
   0g://URI      tx hash          report hash         integrity
                                  = on-chain hash      checks pass
```

| Step | What's Checked | Status When Verified |
|---|---|---|
| 1 | Report stored on 0G Storage | `0g://` URI + root hash |
| 2 | Hash registered on 0G Chain | `AnalysisRecorded` event with root hash |
| 3 | Hashes match | `reportHash === onChainRootHash` → data integrity confirmed |
| 4 | Explorer verified | Valid hash format, score range, recommendation, storage URI |

### Why This Matters

Without integrity verification, a report could be silently modified after submission. With ClawMind's on-chain anchoring, **any tampering is mathematically detectable** — the on-chain hash would no longer match the storage hash.

---

## 🧠 Persistent Memory — Cumulative Intelligence

ClawMind doesn't start from scratch each time. It maintains a **persistent memory index** on 0G Storage that grows with every analysis.

```
Analysis #1 ──▶ Memory Index v1 ──▶ 0G Storage (0g://hash-v1)
                                        │
Analysis #2 ──▶ Memory Retrieval ◀──────┘ (loads v1)
            ──▶ New insights + old context
            ──▶ Memory Index v2 ──▶ 0G Storage (0g://hash-v2)
                                        │
Analysis #3 ──▶ Memory Retrieval ◀──────┘ (loads v2)
            ──▶ Even richer context
            ──▶ Memory Index v3 ──▶ 0G Storage (0g://hash-v3)
```

Each memory record contains: task, summary, score, recommendation, risks, and storage URI. The Memory Graph visualization shows how past analyses influence current decisions.

---

## ⚖️ Judge Mode

A purpose-built **read-only review surface** for hackathon evaluation — no wallet, faucet, or analysis run required.

**🔗 [https://clawmind-puce.vercel.app/judge](https://clawmind-puce.vercel.app/judge)**

### What Judge Mode Shows

| Section | Evidence |
|---|---|
| 0G Compute Status | Active/fallback, model, endpoint |
| 0G Storage Status | Provider, network, configured |
| 0G Chain Registry | Contract address, Explorer link, latest on-chain analysis |
| OpenClaw Manifest | Availability, direct link |
| Latest On-Chain Record | Score, recommendation, root hash, submitter, Explorer links |
| Memory Stats | Total records, 0G Storage-backed count |
| Track 1 Alignment | Checklist showing how each Track 1 requirement is covered |

### Judge API (JSON)

```bash
curl https://clawmind-puce.vercel.app/api/judge
```

Returns structured JSON with **all** 0G integration evidence — compute, storage, chain, OpenClaw, memory stats, and on-chain records.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or bun

### Setup

```bash
# Clone
git clone https://github.com/ILYUTKICK/clawmind.git
cd clawmind

# Install
npm install

# Configure
cp .env.example .env.local
```

### Environment Variables

```env
# ─── 0G Network ───
ZERO_G_NETWORK=mainnet

# ─── 0G Compute (0G Router) ───
ZERO_G_COMPUTE_ENDPOINT=https://router-api.0g.ai/v1/chat/completions
ZERO_G_COMPUTE_API_KEY=your_0g_compute_key
ZERO_G_COMPUTE_MODEL=deepseek/deepseek-chat-v3-0324

# ─── 0G Storage ───
ZERO_G_STORAGE_ENABLED=true
ZERO_G_STORAGE_PRIVATE_KEY=your_burner_wallet_key

# ─── 0G Chain (AnalysisRegistry) ───
ZERO_G_ANALYSIS_REGISTRY_ADDRESS=0x8d53153a8a25c81701954eed66154b3ebba8b8c7

# ─── Optional: bootstrap from previous memory index ───
# ZERO_G_MEMORY_INDEX_URI=0g://...
```

### Run

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Run full 8-step agent pipeline |
| `GET` | `/api/judge` | All 0G integration evidence (JSON) |
| `GET` | `/api/status` | Infrastructure status (compute, storage, chain) |
| `GET` | `/api/verify` | On-chain integrity verification data |
| `GET` | `/api/memory` | Available memory records |
| `POST` | `/api/report/retrieve` | Retrieve report by `0g://` URI or root hash |
| `GET` | `/api/openclaw/manifest` | OpenClaw manifest (YAML) |
| `GET` | `/api/openclaw/manifest?format=json` | OpenClaw manifest + live 0G evidence (JSON) |
| `GET` | `/api/debug` | Full config diagnostics |

### Analyze Request

```bash
curl -X POST https://clawmind-puce.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze this Web3 AI protocol: autonomous trading agent with on-chain execution"}'
```

### Judge API Response (excerpt)

```json
{
  "project": "ClawMind",
  "track": "Track 1: Agentic Infrastructure & OpenClaw Lab",
  "network": { "name": "0G Mainnet", "chainId": 16661 },
  "evidence": {
    "compute": { "active": true, "model": "deepseek/deepseek-chat-v3-0324" },
    "storage": { "configured": true, "provider": "0G_STORAGE" },
    "onChainRegistry": { "configured": true, "address": "0x8d53153a..." }
  }
}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI Compute | 0G Compute Router (`deepseek/deepseek-chat-v3-0324`) |
| Storage | 0G Storage SDK (`@0gfoundation/0g-storage-ts-sdk`) |
| Blockchain | 0G Chain (Mainnet, Chain ID 16661) |
| Smart Contracts | Solidity — `AnalysisRegistry.sol` |
| Web3 | ethers.js v6 |
| Orchestration | OpenClaw-compatible manifest |
| Deployment | Vercel |

---

## 🔑 Key Design Decisions

- **Every analysis is anchored on-chain** — `AnalysisRegistry.sol` records root hash, score, recommendation, and storage URI for each run. The `hashToAnalysisId` mapping enables instant integrity checks.
- **Adversarial, not collaborative** — The Critic Agent actively challenges other agents' outputs, not just summarizes. This prevents groupthink and ensures blind spots are caught.
- **Memory persists across sessions** — Memory index stored on 0G Storage, retrieved via `0g://` URI, boosting relevance for future analyses with cumulative context.
- **8 specialized agents, not one monolith** — Each agent has a narrow role, making the pipeline auditable and debuggable. Data flows are explicit and visible in the UI.
- **0G all the way down** — Compute, Storage, and Chain are all 0G-native. No external AI providers in the primary path.
- **Integrity by design** — On-chain hash matching proves data hasn't been tampered with. This isn't a feature — it's a property of the architecture.
- **Judge Mode requires zero setup** — No wallet, no faucet, no analysis run. Just open the page and verify all 0G integration evidence.

---

## 📂 Repository Structure

```
clawmind/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts            # Main analysis endpoint
│   │   ├── judge/route.ts              # Judge API (0G evidence)
│   │   ├── debug/route.ts              # Debug diagnostics
│   │   ├── verify/route.ts             # Integrity verification API
│   │   ├── status/route.ts             # Infrastructure status
│   │   ├── memory/route.ts             # Memory records
│   │   ├── openclaw/manifest/route.ts  # OpenClaw manifest
│   │   └── report/retrieve/route.ts    # 0G Storage retrieval
│   ├── judge/page.tsx                  # Judge Mode UI
│   └── page.tsx                        # Main app UI
├── components/
│   ├── AgentReasoningFlow.tsx          # Agent pipeline visualization
│   ├── MemoryGraph.tsx                 # Memory flow visualization
│   ├── AdversarialPanel.tsx            # Critic Agent challenges
│   ├── IntegrityPanel.tsx              # On-chain integrity verification
│   ├── InfrastructureEvidence.tsx      # 0G proof points panel
│   ├── OnChainReceiptPanel.tsx         # On-chain receipt with Explorer links
│   └── ...                            # Report, Memory, Receipt panels
├── contracts/
│   └── AnalysisRegistry.sol            # On-chain analysis anchor
├── lib/
│   ├── agents/                         # 8 specialized agent modules
│   │   ├── planner.ts
│   │   ├── researcher.ts
│   │   ├── risk-agent.ts
│   │   ├── architect.ts
│   │   ├── critic.ts                   # Adversarial review agent
│   │   └── final-agent.ts             # Decision synthesis
│   ├── compute/zero-g-compute.ts       # 0G Compute integration
│   ├── contracts/analysis-registry.ts  # On-chain registration
│   ├── memory/memory-manager.ts        # Persistent memory layer
│   ├── orchestrator/run-analysis.ts    # Pipeline orchestrator
│   └── storage/
│       ├── zero-g-config.ts            # Shared 0G network config
│       ├── zero-g-storage.ts           # 0G Storage (reports)
│       ├── zero-g-memory-index.ts      # 0G Storage (memory index)
│       ├── zero-g-memory-retrieval.ts  # 0G Storage (memory retrieval)
│       └── zero-g-retrieval.ts         # 0G Storage (retrieval)
└── openclaw.yaml                       # OpenClaw manifest
```

---

## ⚠️ Safety Model

ClawMind is a **reasoning and decision-support system**. It does not execute transactions or sign messages.

- LLM agents **analyze and recommend** — they never move funds
- Transaction execution belongs in a separate deterministic policy layer
- High-risk operations require human approval or strict automated guardrails
- Storage receipts provide auditability; memory provides context, not truth
- The Critic Agent's adversarial role is to **identify risks**, not to execute mitigations

---

## 📄 License

Experimental agentic infrastructure prototype. Review and adapt before production use.
