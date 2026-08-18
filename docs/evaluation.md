# Evaluation

ClawMind evaluation is designed to answer a practical question:

> Does the multi-agent pipeline produce meaningfully different outcomes for different risk profiles, or does it collapse toward the same generic recommendation?

The current project includes scenario-based test tasks and critic-driven score adjustments.

---

## Recommendation Space

The final decision is one of:

```text
GO
INVESTIGATE_MORE
NO_GO
```

The scoring layer is not treated as a pure LLM opinion. The project also contains deterministic logic for selected high-risk patterns.

---

## Critic Penalties

Current severity adjustments:

| Critic severity | Score adjustment |
|---|---:|
| High | -15 |
| Medium | -7 |
| Low | -3 |

The Critic can emit multiple structured challenges.

Evaluation should verify that:

- challenges are grounded in the task/evidence;
- severity is plausible;
- unresolved material issues affect the final result;
- harmless cases are not over-penalized.

---

## Core Evaluation Scenarios

### Scenario A — Read-only analytics

Example task:

```text
Review a read-only Web3 analytics dashboard for Uniswap pools.
It uses public indexed data only, has no wallet connection,
no transaction signing, no custody, no admin keys,
and no ability to move funds.
```

Expected behavior:

```text
Recommendation: GO
Approximate score: 75-90
```

What this tests:

- non-custodial signals;
- avoidance of false high-risk classification;
- ability to recognize strong deterministic safety properties.

---

### Scenario B — Unsafe autonomous custody

Example task:

```text
Self-custodial agent that auto-trades user funds with no withdrawal
guards and a private key in an environment variable.
```

Expected behavior:

```text
Recommendation: NO_GO
Approximate score: 10-25
```

What this tests:

- custody detection;
- private-key risk;
- missing approval/withdrawal controls;
- critic severity;
- deterministic final-stage safety rules.

---

### Scenario C — Ambiguous AMM

Example task:

```text
New AMM with novel TWAP oracle, audited by one firm,
$5M TVL, anonymous team.
```

Expected behavior:

```text
Recommendation: INVESTIGATE_MORE
Approximate score: 35-60
```

What this tests:

- uncertainty handling;
- oracle risk;
- audit evidence;
- incomplete governance/team signals.

---

### Scenario D — Nonsense input

Example:

```text
asdf qwerty
```

Expected behavior:

```text
Refusal or very low-confidence / very low-score output
```

What this tests:

- input quality handling;
- resistance to producing confident fabricated due diligence.

---

### Scenario E — Governance / bridge edge case

Example:

```text
Upgradeable cross-chain bridge with admin key rotation,
delayed oracle fallback, and $20M planned TVL.
```

Expected behavior:

```text
INVESTIGATE_MORE
```

What this tests:

- governance/admin controls;
- bridge complexity;
- oracle fallback;
- incomplete evidence.

---

## Suggested Evaluation Table

For each run, record:

| Field | Description |
|---|---|
| Task | Input prompt |
| Expected recommendation | GO / INVESTIGATE_MORE / NO_GO |
| Expected score range | Approximate range |
| Actual recommendation | Runtime output |
| Actual score | Runtime output |
| Critic challenges | Count |
| High / Medium / Low | Severity distribution |
| Memory retrieved | Relevant prior context |
| Pass / Fail | Evaluation result |

---

## What to Measure

### 1. Recommendation differentiation

Different risk profiles should not collapse to one recommendation.

### 2. Score differentiation

Scores should reflect task severity rather than clustering around one value.

### 3. Critic effectiveness

Compare:

```text
score before critic
score after critic
challenge count
severity distribution
```

### 4. Deterministic safety behavior

High-risk custody/signing conditions should be handled consistently across repeated runs.

### 5. Memory influence

Re-running semantically similar tasks should surface relevant previous analyses without forcing identical final answers.

### 6. Malformed model output

Structured parser fallback paths should be tested with:

- invalid JSON;
- fenced JSON;
- trailing commas;
- missing severity;
- missing explanation;
- too many challenges.

---

## Reproducibility

For evaluation runs, capture:

```text
task
model/provider
timestamp
memory context
agent outputs
critic output
final recommendation
final score
report hash / receipt
```

This makes it possible to compare reasoning behavior independently from report provenance.
