# ClawMind Demo Script

## One-line Pitch

ClawMind is a persistent multi-agent cognitive backbone for autonomous Web3 decision-making, powered by 0G Compute and 0G Storage.

---

## 30-second Pitch

ClawMind is not a chatbot. It is a multi-agent decision engine for Web3 and AI builders.

It takes a project idea, retrieves relevant memory, runs a specialized agent pipeline, generates a structured risk report, and stores the final result in 0G Storage.

The project is built for 0G APAC Track 1 because it focuses on agent orchestration, specialized Skills, 0G Compute inference, and 0G Storage-based state persistence.

---

## 1-minute Demo Script

Today I am showing ClawMind, a persistent multi-agent cognitive backbone for autonomous Web3 decision-making.

The problem is that Web3 builders often evaluate projects using fragmented information: protocol docs, GitHub, tokenomics, security assumptions, and previous research. Normal LLM tools start from zero every time.

ClawMind solves this by using a modular agent pipeline.

When I submit a Web3 AI protocol idea, ClawMind first retrieves relevant memories. Then it runs several specialized agents:

```txt
Planner
Researcher
Risk Agent
Architect
Critic
Final Decision Agent
Memory Writer
```

Each agent produces an intermediate output, and the orchestrator combines everything into a structured final report.

The report includes:

- risk map
- opportunity analysis
- architecture suggestions
- next steps
- final score
- recommendation

The key part is that ClawMind uses 0G Compute as the inference layer and 0G Storage to persist the final report.

Here, the Decision Receipt shows:

```txt
Provider: 0G_STORAGE
Report Hash: 0x...
Storage URI: 0g://...
```

This means the analysis is not just generated temporarily. It is stored as persistent state that can be referenced later.

---

## 3-minute Demo Script

### Step 1 — Introduce the Problem

Web3 and AI builders constantly need to evaluate risky ideas quickly.

For example:

```txt
Should we build an autonomous DeFi agent that manages user funds?
What are the risks?
What architecture should we use?
What should be stored and verified?
```

The issue is that most AI tools are stateless. They answer once, but they do not behave like a persistent decision system.

ClawMind is designed as a cognitive backbone for this type of workflow.

---

### Step 2 — Show the Input

I paste this demo input:

```txt
Analyze this Web3 AI protocol idea:
An autonomous DeFi agent manages user funds across multiple yield protocols,
uses LLM reasoning to rebalance positions, and optimizes APY while storing
decisions in decentralized infrastructure.
```

Then I click:

```txt
Run Analysis
```

---

### Step 3 — Show the Agent Pipeline

The pipeline runs several specialized agents:

```txt
Memory Retrieval
Planner Agent
Research Agent
Risk Agent
Architect Agent
Critic Agent
Final Decision Agent
Memory Writer
```

This is the orchestration layer.

The important point is that ClawMind is not making a single LLM call. It decomposes the task into specialized reasoning nodes.

---

### Step 4 — Show Relevant Memories

The memory panel shows previous risk patterns such as:

```txt
Custody risk
Oracle manipulation
Unsafe autonomous execution
Private key exposure
Policy bypass
LLM hallucinated actions
```

This is the foundation for long-context memory.

The next version will store and retrieve generated memory records directly through 0G Storage.

---

### Step 5 — Show Final Report

The final report includes:

- summary
- score
- recommendation
- risk map
- opportunities
- architecture
- next steps
- evidence log

For this DeFi agent example, ClawMind correctly identifies major risks:

```txt
Autonomous execution risk
Custody and permission risk
External data reliability risk
Memory poisoning risk
```

This is exactly the type of analysis needed before building autonomous Web3 agents.

---

### Step 6 — Show 0G Compute

In the agent pipeline, ClawMind uses the compute abstraction layer:

```txt
lib/compute/zero-g-compute.ts
```

This allows agents to run through 0G Compute / 0G Router while keeping a local fallback for demo stability.

The Memory Writer step shows the active compute provider.

---

### Step 7 — Show 0G Storage

The Decision Receipt shows:

```txt
Provider: 0G_STORAGE
Report Hash: 0x...
Storage URI: 0g://...
```

This proves that the final report was persisted through 0G Storage.

This directly maps to the Track 1 priority requirement:

```txt
state persistence and long-context memory
```

---

### Step 8 — Close

ClawMind demonstrates how autonomous AI systems can be built as persistent agentic infrastructure, not just chat interfaces.

It combines:

- multi-agent orchestration
- specialized Skills
- 0G Compute inference
- 0G Storage persistence
- verifiable decision receipts

The next step is real memory persistence: each analysis will create a reusable memory record that future runs can retrieve and reason over.

---

## Judge Q&A

### Q: Is this just a chatbot?

No. ClawMind uses a modular agent pipeline with specialized roles, orchestration, memory context, structured reports, and storage receipts.

### Q: Where is 0G Compute used?

Agents call a shared compute abstraction layer in:

```txt
lib/compute/zero-g-compute.ts
```

This layer connects to 0G Compute / 0G Router through environment variables.

### Q: Where is 0G Storage used?

Final reports are uploaded through:

```txt
lib/storage/zero-g-storage.ts
```

The UI displays the resulting provider, report hash, and storage URI.

### Q: How does this fit Track 1?

ClawMind implements:

- cognitive backbone
- orchestration layer
- agent framework
- specialized Skills
- data-processing pipeline
- 0G Compute inference
- 0G Storage persistence

### Q: What is the next technical milestone?

Real memory persistence.

Each report should generate a memory record, store it in 0G Storage, and retrieve it during future agent runs.

### Q: Why is this useful?

Autonomous agents need persistent decision context, not stateless one-off answers. ClawMind gives Web3 builders a reusable, auditable decision layer.