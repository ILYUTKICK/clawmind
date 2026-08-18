# Agents

ClawMind uses specialized reasoning agents rather than a single monolithic prompt.

The current agent modules are:

```text
lib/agents/
├── planner.ts
├── researcher.ts
├── risk-agent.ts
├── architect.ts
├── critic.ts
└── final-agent.ts
```

## Agent Flow

```text
Relevant Memory
      |
      v
   Planner
      |
      v
 Researcher
   |      \
   v       v
 Risk   Architect
   \       /
    \     /
      Critic
        |
        v
    Final Agent
```

---

## Planner

**File:** `lib/agents/planner.ts`

### Responsibility

Turn the user task into a concise execution plan for specialized agents.

### Inputs

```text
task
memoryContext
```

### Output

A step-by-step analysis plan.

### Why it is separate

The Planner decides **how to investigate** before the later agents decide **what the evidence means**.

This prevents every downstream stage from independently inventing its own interpretation of the task.

---

## Researcher

**File:** `lib/agents/researcher.ts`

### Responsibility

Extract factual signals and uncertainty from the user task and plan.

The prompt asks the Researcher to identify:

- facts;
- assumptions;
- missing context;
- useful signals.

### Inputs

```text
task
plan
```

### Output

A concise evidence-oriented research result.

### Why it is separate

The downstream Risk Agent and Architect should reason over a shared evidence layer rather than separately re-reading the raw task.

---

## Risk Agent

**File:** `lib/agents/risk-agent.ts`

### Responsibility

Identify the most material risks in the proposed system.

### Inputs

```text
task
researchOutput
memoryContext
```

### Risk categories

The current prompt covers:

```text
security
financial
autonomy
privacy
governance
data
infrastructure
```

### Output

A concise set of risks with explanations.

### Why memory is included

Historical analyses can reveal recurring failure patterns or previously observed controls that are relevant to a new task.

---

## Architect

**File:** `lib/agents/architect.ts`

### Responsibility

Produce practical architecture recommendations from the task and available evidence.

### Inputs

```text
task
researchOutput
riskOutput
```

### Graceful fallback

The Architect can run without a Risk Agent result. In that case, it explicitly proceeds using research findings alone.

### Output

A concise architecture recommendation, currently limited to a small set of bullet points.

---

## Critic

**File:** `lib/agents/critic.ts`

### Responsibility

Challenge claims and assumptions produced by the earlier agents.

The Critic is designed as an adversarial layer rather than another summary stage.

### Structured output

```ts
type CriticChallenge = {
  challenge: string;
  severity: "low" | "medium" | "high";
  explanation: string;
};

type CriticOutput = {
  challenges: CriticChallenge[];
  summary: string;
};
```

The runtime normalizes critic output and limits the number of accepted challenges.

### Failure handling

The parser:

- accepts fenced or raw JSON;
- strips common malformed trailing commas;
- normalizes invalid severity values;
- supplies fallback text for missing explanations;
- rejects unusable objects.

### Why the Critic matters

Critic findings are surfaced to the final stage and contribute to score adjustments.

Current severity adjustments described by the project:

| Severity | Score adjustment |
|---|---:|
| High | -15 |
| Medium | -7 |
| Low | -3 |

The intent is to make adversarial review materially affect the final result.

---

## Final Agent

**File:** `lib/agents/final-agent.ts`

### Responsibility

Convert the complete analysis into a structured decision.

### Recommendation classes

```text
GO
INVESTIGATE_MORE
NO_GO
```

### Inputs

The final stage combines earlier reasoning artifacts, including:

- research;
- risks;
- architecture;
- critic findings;
- task facts.

### Deterministic guards

The implementation includes deterministic pattern checks for selected high-impact conditions.

Examples include:

- custody and private-key exposure;
- missing withdrawal or approval guards;
- oracle risks;
- audit evidence;
- governance/admin controls;
- liquidity/TVL signals.

These checks are intended to prevent the final result from depending exclusively on unconstrained model output.

---

## Memory Writer

Memory writing is part of the full cognitive pipeline even though it is not implemented as a file inside `lib/agents/`.

After a completed analysis, useful runtime knowledge can be appended to persistent memory so later tasks can retrieve it.

See [memory.md](memory.md).

---

## Agent Design Guidelines

When extending the system:

1. Keep each agent responsible for one clear reasoning role.
2. Prefer structured outputs for stages that affect scoring or control flow.
3. Do not hide deterministic policy rules inside natural-language prompts.
4. Keep fallback behavior explicit.
5. Add evaluation cases when changing recommendation logic.
6. Avoid making the Critic decorative; critic feedback should remain observable downstream.
