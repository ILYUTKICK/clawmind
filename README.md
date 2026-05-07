# ClawMind

Persistent multi-agent cognitive backbone for autonomous Web3 decision-making.

ClawMind is a web application and agent orchestration layer that analyzes Web3/AI protocol ideas through a structured multi-agent pipeline. It combines agent reasoning, persistent memory, structured decision reports, 0G Compute-compatible inference, 0G Storage persistence, and OpenClaw-compatible orchestration metadata.

---

## Overview

ClawMind is designed to help evaluate autonomous Web3/AI systems before they are used in high-risk environments.

The system receives a project idea or protocol description, retrieves relevant prior memories, runs several specialized agents, generates a structured decision report, persists the result to 0G Storage, and creates a reusable memory index for future analysis runs.

Core capabilities:

- multi-agent reasoning pipeline;
- task decomposition;
- research and assumption extraction;
- Web3/AI risk analysis;
- architecture recommendations;
- adversarial critique;
- structured `MODEL_JSON` final reports;
- persistent memory reuse;
- 0G Compute-compatible inference;
- 0G Storage report persistence;
- 0G Storage memory index persistence;
- report retrieval by `0g://` URI or root hash;
- OpenClaw-compatible orchestration manifest.

---

## Live Application

```txt
https://clawmind-puce.vercel.app
```

Repository:

```txt
https://github.com/ILYUTKICK/clawmind
```

---

## Core Workflow

```txt
User Task
  ↓
Memory Retrieval
  ↓
Planner Agent
  ↓
Research Agent
  ↓
Risk Agent
  ↓
Architect Agent
  ↓
Critic Agent
  ↓
Final Decision Agent
  ↓
Structured MODEL_JSON Report
  ↓
0G Storage Decision Receipt
  ↓
Memory Writer
  ↓
0G Storage Memory Index Receipt
```

The output is a structured decision report containing:

- summary;
- score;
- recommendation;
- risk map;
- opportunities;
- architecture suggestions;
- next steps;
- evidence log;
- storage receipt;
- memory index receipt.

---

## Architecture

```txt
Frontend UI
  ↓
Next.js API Routes
  ↓
Agent Orchestrator
  ↓
Memory Layer
  ↓
0G Compute-Compatible Inference Layer
  ↓
Specialized Agent Pipeline
  ↓
Structured Final Report
  ↓
0G Storage Persistence
  ↓
Memory Index Persistence
```

Main orchestration entrypoint:

```txt
lib/orchestrator/run-analysis.ts
```

The orchestrator controls the full analysis flow:

1. retrieves relevant memories;
2. runs specialized agents in sequence;
3. builds a structured final report;
4. stores the report;
5. creates a new memory record;
6. uploads the memory index;
7. returns all pipeline steps, receipts, and report data to the UI.

---

## Agent Pipeline

| Step | Agent | Responsibility | Output |
|---:|---|---|---|
| 1 | Memory Retrieval | Finds relevant previous memory records | Relevant memory context |
| 2 | Planner Agent | Breaks the task into analysis objectives | Execution plan |
| 3 | Research Agent | Extracts facts, assumptions, and missing context | Research findings |
| 4 | Risk Agent | Identifies Web3 and AI-related risks | Risk map |
| 5 | Architect Agent | Proposes a safer system architecture | Architecture recommendations |
| 6 | Critic Agent | Challenges assumptions and missing safeguards | Critical review |
| 7 | Final Decision Agent | Produces the structured final report | `MODEL_JSON` report |
| 8 | Memory Writer | Persists a new memory and memory index | 0G memory receipt |

---

## Agents

### Planner Agent

Builds the analysis plan and defines what the system needs to evaluate.

Typical output:

- objectives;
- key components;
- risk areas;
- analysis sequence.

### Research Agent

Extracts facts and assumptions from the user-provided project description.

Typical output:

- protocol facts;
- assumptions;
- missing details;
- data requirements.

### Risk Agent

Identifies risks specific to autonomous Web3/AI systems.

Common risk categories:

- custody risk;
- oracle manipulation;
- unsafe autonomous execution;
- private key exposure;
- policy bypass;
- hallucinated LLM actions;
- external data reliability;
- memory poisoning.

### Architect Agent

Proposes a safer architecture for the described system.

Typical recommendations:

- agent orchestration layer;
- deterministic policy checks;
- human-in-the-loop controls;
- multi-signature wallets;
- decentralized storage layer;
- monitoring and rollback mechanisms.

### Critic Agent

Adversarially reviews the plan and highlights missing safeguards.

Typical output:

- weak assumptions;
- missing controls;
- unclear execution boundaries;
- insufficient validation logic.

### Final Decision Agent

Converts all intermediate agent outputs into a structured decision report.

The final output is parsed as JSON and rendered as a report in the UI.

Expected structure:

```json
{
  "summary": "string",
  "score": 0,
  "recommendation": "GO | NO_GO | INVESTIGATE_MORE",
  "risks": [
    {
      "title": "string",
      "severity": "low | medium | high | critical",
      "explanation": "string"
    }
  ],
  "opportunities": ["string"],
  "architecture": ["string"],
  "nextSteps": ["string"],
  "evidence": ["string"]
}
```

### Memory Writer

Creates a new memory record from the final report and persists the updated memory index.

---

## OpenClaw-compatible Manifest

ClawMind includes an OpenClaw-compatible orchestration manifest.

Repository file:

```txt
openclaw.yaml
```

Live endpoint:

```txt
/api/openclaw/manifest
```

The manifest describes:

- project metadata;
- runtime entrypoints;
- agent pipeline;
- specialized skills;
- agent inputs and outputs;
- memory dependencies;
- 0G Compute usage;
- 0G Storage artifacts;
- execution safety policy.

Example:

```yaml
name: clawmind
version: 1.0.0
kind: agentic-infrastructure

orchestration:
  mode: sequential-multi-agent-pipeline
  state_persistence:
    primary: 0G_STORAGE
    fallback: LOCAL_FALLBACK
  compute:
    primary: 0G_COMPUTE_ROUTER
    fallback: LOCAL_DETERMINISTIC_INFERENCE
```

The manifest can be inspected directly in the browser through:

```txt
https://clawmind-puce.vercel.app/api/openclaw/manifest
```

---

## 0G Compute Integration

ClawMind uses a shared inference abstraction for agent calls.

Main file:

```txt
lib/compute/zero-g-compute.ts
```

The compute layer supports:

- 0G Compute / 0G Router compatible endpoint;
- OpenAI-compatible chat completions format;
- agent-specific system prompts;
- lower temperature for structured final reports;
- increased token budget for full JSON generation;
- local deterministic fallback for development/demo stability.

The Final Decision Agent uses stricter output rules to produce parseable structured JSON.

Example behavior:

```txt
Planner Agent → text plan
Research Agent → text findings
Risk Agent → risk analysis
Architect Agent → architecture proposal
Critic Agent → critique
Final Decision Agent → MODEL_JSON
```

---

## 0G Storage Integration

ClawMind persists two main artifact types through 0G Storage.

### 1. Decision Report

Each completed analysis produces a decision receipt.

The receipt includes:

```txt
Provider
Report Hash
Storage URI
Created At
```

Example:

```txt
Provider: 0G_STORAGE
Report Hash: 0x...
Storage URI: 0g://...
```

The report can later be retrieved by URI or root hash through the UI.

### 2. Memory Index

After each analysis, ClawMind creates a memory record and uploads the memory index.

The memory index receipt includes:

```txt
Provider
Memory Index Hash
Memory Index URI
Created At
```

Example:

```txt
Provider: 0G_STORAGE
Memory Index Hash: 0x...
Memory Index URI: 0g://...
```

---

## Report Retrieval

ClawMind includes a retrieval panel for persisted reports.

Input formats:

```txt
0g://<root_hash>
<root_hash>
```

The retrieval flow:

```txt
Storage URI / Root Hash
  ↓
0G Storage Indexer
  ↓
Stored Report
  ↓
Retrieved Decision UI
```

The retrieved report displays:

- original task;
- stored timestamp;
- score;
- recommendation;
- summary;
- risks.

---

## Persistent Memory

ClawMind uses persistent memory to reuse prior analysis context.

Memory sources:

- generated memories from previous runs;
- local persistent memory during development;
- memory index loaded from 0G Storage;
- optional seed memories for demo continuity.

Memory records include:

```ts
{
  id: string;
  task: string;
  summary: string;
  risks: string[];
  recommendation: string;
  score: number;
  storageUri?: string;
  createdAt: string;
}
```

The memory layer:

- scores memories against the current task;
- boosts relevant risk overlap;
- boosts records backed by `0g://` storage;
- deduplicates similar task memories;
- limits displayed relevant memories;
- provides memory context to downstream agents.

Optional 0G memory bootstrap:

```env
ZERO_G_MEMORY_INDEX_URI=0g://your_previous_memory_index_root_hash
```

---

## Infrastructure Evidence Panel

The UI includes an Infrastructure Evidence panel.

It summarizes live proof points for:

```txt
0G Compute
Report Storage
Memory Index Storage
Structured Output
OpenClaw Manifest
```

After a successful analysis, the panel displays:

```txt
0G Compute: Active
Report Storage: 0G_STORAGE / Verified
Memory Index Storage: 0G_STORAGE / Verified
Structured Output: MODEL_JSON / Verified
OpenClaw Manifest: Available
```

The OpenClaw manifest entry links to:

```txt
/api/openclaw/manifest
```

---

## UI Panels

The application UI is organized into several panels.

### Input Form

Accepts the project or protocol idea to analyze.

### System Status

Displays runtime status for:

- agent inference layer;
- report persistence;
- memory index;
- root hash retrieval.

### Infrastructure Evidence

Displays live proof points for compute, storage, structured output, and manifest availability.

### Agent Pipeline

Shows all pipeline steps and their current status.

Each step includes:

- compact output preview;
- completion state;
- raw agent output disclosure.

### Relevant Memories Used

Shows the most relevant memory records used in the current analysis.

### Decision Receipt

Shows the persisted report hash and storage URI.

### Memory Index Receipt

Shows the persisted memory index hash and URI.

### Retrieve Report from 0G Storage

Allows retrieving a stored report by `0g://` URI or root hash.

### Final Report

Displays the structured decision report.

---

## API Endpoints

### Analyze

```txt
POST /api/analyze
```

Runs the full multi-agent analysis pipeline.

Request body:

```json
{
  "task": "Analyze this Web3 AI protocol idea..."
}
```

Response includes:

- task;
- agent steps;
- relevant memories;
- report;
- decision receipt;
- memory index receipt.

---

### Memory

```txt
GET /api/memory
```

Returns available memory records.

Depending on implementation state, this can include local persistent memory, generated memory, and seed memory.

---

### Report Retrieval

```txt
POST /api/report/retrieve
```

Retrieves a persisted report from 0G Storage.

Request body:

```json
{
  "storageUri": "0g://..."
}
```

or:

```json
{
  "rootHash": "0x..."
}
```

---

### OpenClaw Manifest

```txt
GET /api/openclaw/manifest
```

Returns the `openclaw.yaml` manifest as plain text.

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
      openclaw/
        manifest/
          route.ts
      report/
        retrieve/
          route.ts
    globals.css
    layout.tsx
    page.tsx

  components/
    AgentPipeline.tsx
    InfrastructureEvidence.tsx
    InputForm.tsx
    MemoryIndexReceipt.tsx
    MemoryPanel.tsx
    ReportView.tsx
    RetrievedReportPanel.tsx
    StorageReceipt.tsx
    SystemStatus.tsx
    TrackFitPanel.tsx

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
      persistent-memory-store.ts
    orchestrator/
      run-analysis.ts
    storage/
      storage-receipt.ts
      zero-g-memory-index.ts
      zero-g-memory-retrieval.ts
      zero-g-retrieval.ts
      zero-g-storage.ts
    types.ts

  openclaw.yaml
  .env.example
  README.md
```

---

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- 0G Compute-compatible inference endpoint
- 0G Storage TypeScript SDK
- ethers
- Vercel

---

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Run checks:

```bash
npm run lint
npm run build
```

---

## Environment Variables

Use `.env.example` as the source of truth for required variables.

Typical local setup:

```env
# 0G Compute / Router
ZERO_G_COMPUTE_ENDPOINT=
ZERO_G_COMPUTE_API_KEY=
ZERO_G_COMPUTE_MODEL=

# 0G Storage
ZERO_G_STORAGE_ENABLED=
ZERO_G_STORAGE_PRIVATE_KEY=
ZERO_G_STORAGE_EVM_RPC=
ZERO_G_STORAGE_INDEXER_RPC=

# Optional memory bootstrap
ZERO_G_MEMORY_INDEX_URI=
```

Depending on the storage integration version, storage variable names may follow the exact names defined in `.env.example`.

Do not commit `.env.local`.

---

## Environment Safety

Never commit:

```txt
.env.local
private keys
API keys
wallet secrets
```

Recommended practices:

- use a testnet burner wallet;
- keep production secrets in Vercel Environment Variables;
- keep `.env.example` public and secret-free;
- rotate exposed test keys if needed;
- do not use a main wallet private key.

---

## Vercel Deployment

ClawMind can be deployed as a standard Next.js application.

Deployment steps:

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Add environment variables from `.env.example`.
4. Deploy.
5. Open the live app.
6. Run an analysis.
7. Verify receipts and report retrieval.

After changing environment variables in Vercel, redeploy the project.

---

## Production Validation Checklist

After deployment, verify:

```txt
/                          opens the ClawMind UI
/api/openclaw/manifest     returns openclaw.yaml
Run Analysis               completes the agent pipeline
Final Report               shows MODEL_JSON in evidence log
Decision Receipt           shows 0G_STORAGE
Memory Index Receipt       shows 0G_STORAGE
Retrieve Report            retrieves a stored report
Relevant Memories Used     shows deduplicated memory records
Infrastructure Evidence    shows verified proof points
```

---

## Safety Model

ClawMind is a reasoning and decision-support system.

It is not designed to directly execute transactions or sign messages.

Core safety assumptions:

- LLM agents may analyze and recommend.
- LLM agents should not directly move funds.
- Transaction execution should be handled by a separate deterministic policy layer.
- High-risk operations should require human approval or strict automated guardrails.
- Storage receipts should be used for auditability.
- Memory should be treated as useful context, not absolute truth.
- Retrieved memory can influence analysis but should not override fresh risk evaluation.

---

## Local Fallback Behavior

ClawMind includes fallback behavior for development and demo stability.

Fallbacks may be used when:

- 0G Compute variables are missing;
- the compute endpoint is unavailable;
- the storage layer cannot write;
- local development is running without production secrets.

Fallback behavior is intended to keep the UI usable, while the Infrastructure Evidence panel and receipts make the active provider visible.

---

## Current Features

- Multi-agent orchestration pipeline
- Agent-specific prompts
- 0G Compute-compatible inference layer
- Structured `MODEL_JSON` final report parsing
- Dynamic score and recommendation rendering
- Risk map generation
- Architecture recommendation generation
- Evidence log
- Decision Receipt
- Memory Index Receipt
- 0G Storage report persistence
- 0G Storage memory index persistence
- Report retrieval by `0g://` URI or root hash
- Persistent memory reuse
- Memory deduplication
- Relevant memory panel
- Infrastructure Evidence panel
- System Status panel
- OpenClaw-compatible `openclaw.yaml`
- Live `/api/openclaw/manifest` endpoint
- Vercel deployment support

---

## Version History

### v1.0.0

- Added OpenClaw-compatible `openclaw.yaml`.
- Added `/api/openclaw/manifest`.
- Added Infrastructure Evidence panel.
- Added structured final report parsing.
- Added `MODEL_JSON` report generation mode.
- Added 0G Storage memory index receipt.
- Added 0G Storage report retrieval.
- Added relevant memory deduplication.
- Improved Final Decision Agent output handling.
- Improved Agent Pipeline UI.
- Improved persistent memory flow.

### Earlier versions

- Added initial multi-agent pipeline.
- Added 0G Compute-compatible inference.
- Added 0G Storage report persistence.
- Added generated memory records.
- Added system status and receipt panels.

---

## Roadmap

Potential next improvements:

- document upload analysis;
- URL and GitHub README analysis;
- semantic memory ranking with embeddings;
- UI-based memory index loading from 0G Storage;
- per-project memory spaces;
- visual architecture graph;
- policy-gated execution simulation;
- agent trace export;
- richer report retrieval history;
- source-grounded risk evidence;
- memory quality scoring.

---

## License

This project is provided as an experimental agentic infrastructure prototype.

Review and adapt the code before using it in production or with real assets.
