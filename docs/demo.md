# Demo

This walkthrough is designed to demonstrate the AI engineering aspects of ClawMind in a few minutes.

It focuses on:

- multi-agent reasoning;
- critic-driven review;
- semantic memory;
- structured recommendation;
- report provenance.

Avoid showing private environment values, deployment secrets, private keys, or terminal history that contains sensitive configuration.

---

## Demo Prompt

Use a high-risk example so the Risk Agent, Critic, and final scoring logic are visible:

```text
Self-custodial Web3 agent that auto-trades user funds.
The private key is stored in an environment variable.
There are no withdrawal guards, no multisig,
no circuit breaker, and no user approval step before trades.
```

Expected direction:

```text
NO_GO
```

---

## 1. Product Overview

Open:

```text
https://clawmind-puce.vercel.app
```

Explain in one sentence:

> ClawMind is a multi-agent decision-support system that separates planning, evidence extraction, risk analysis, architecture review, adversarial critique, and final recommendation.

Keep the focus on the AI architecture rather than the blockchain domain.

---

## 2. Start an Analysis

Open:

```text
https://clawmind-puce.vercel.app/analysis
```

Paste the demo prompt and start the analysis.

Point out the reasoning stages as they appear:

```text
Memory Retrieval
Planner
Researcher
Risk Agent
Architect
Critic
Final Agent
```

---

## 3. Show the Critic

When the Critic output is available, highlight:

- structured challenges;
- severity;
- explanation;
- unresolved issues;
- effect on the final score.

The important message is:

> The Critic is not just explanatory text; its findings are part of the decision path.

---

## 4. Show the Final Decision

Highlight:

```text
recommendation
score
key risks
architecture recommendations
critic findings
```

For the high-risk demo prompt, the expected direction is a strongly negative result.

---

## 5. Show Memory

Open the public status/verification surface and show that the application tracks semantic-memory activity.

Explain:

> Previous analyses can be embedded, retrieved as relevant context, and persisted for later runs.

Do not overclaim memory quality; it is an engineering subsystem that must be evaluated.

---

## 6. Show the Receipt

Open the receipt for the completed analysis.

Explain the distinction:

> The receipt proves the integrity/provenance of the stored report. It does not prove the model's conclusion is correct.

This is the safest and clearest way to explain the verification layer.

---

## 7. Optional MCP Demo

Use an MCP-compatible client with:

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

Call:

```text
analyze_web3_project(task)
```

This demonstrates that the reasoning pipeline is reusable outside the browser UI.

---

## 8. Suggested Portfolio Screenshots

Save:

```text
docs/images/analysis.png
docs/images/critic.png
docs/images/receipt.png
```

Recommended content:

### `analysis.png`

Show:

- task;
- agent pipeline;
- final recommendation.

### `critic.png`

Show:

- critic challenges;
- severity;
- score impact.

### `receipt.png`

Show:

- stored report metadata;
- hash/provenance information;
- signed registry status.

---

## Short Demo Narrative

A concise walkthrough can follow this order:

1. Submit a task.
2. Retrieve relevant memory.
3. Planner defines the investigation.
4. Researcher extracts facts and uncertainty.
5. Risk Agent and Architect evaluate the task.
6. Critic challenges weak assumptions.
7. Final Agent produces a structured recommendation.
8. Report is stored and made verifiable.
9. The same capability is callable through MCP.
