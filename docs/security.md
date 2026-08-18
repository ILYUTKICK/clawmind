# Security and Safety

ClawMind is a decision-support and due-diligence system. It is not a formal security audit tool, exploit detector, custody system, or autonomous transaction executor.

## Safety Boundary

The AI pipeline can:

- analyze user-provided project descriptions;
- identify risks;
- propose architecture changes;
- challenge assumptions;
- produce a structured recommendation.

It should not be treated as authority to:

- move funds;
- manage private keys;
- approve protocol upgrades;
- bypass deterministic policy controls;
- replace human review for high-impact actions.

---

## Human and Deterministic Controls

Systems involving:

- custody;
- transaction signing;
- private keys;
- withdrawals;
- protocol upgrades;
- admin controls;
- automated execution;

should use deterministic controls and explicit human approval outside the LLM pipeline.

---

## Final-Stage Safety Logic

The final decision implementation contains deterministic checks for selected high-risk conditions, including signals related to:

- custody;
- private-key exposure;
- missing withdrawal guards;
- signing controls;
- oracle risk;
- audit evidence;
- governance/admin configuration;
- liquidity maturity.

These rules provide an additional safety layer but are not a complete policy engine.

---

## Smart-Contract Quality Checks

The root package defines:

```bash
npm run test:contracts
npm run audit:contracts
npm run audit:contracts:slither
```

`audit:contracts` combines static analysis and contract tests.

Existing audit notes live under:

```text
docs/audits/
```

Keep accepted static-analysis findings documented rather than silently suppressing them.

---

## Secrets

Do not commit:

- compute API keys;
- private keys;
- storage signing keys;
- production Redis credentials;
- registry operator secrets.

Use environment variables and deployment-secret storage.

The demo documentation should never instruct users to show `.env`, terminal history containing secrets, or private deployment settings.

---

## Rate Limiting

The public analysis surface is rate-limited.

The MCP interface also requires a client identifier and applies per-client limits.

Rate limits should be considered part of abuse prevention, not only cost control.

---

## Prompt and Input Risk

ClawMind reasons over user-controlled task text.

Potential risks include:

- prompt injection;
- intentionally misleading descriptions;
- omitted facts;
- false claims;
- adversarial inputs;
- nonsense inputs.

For high-stakes use, the system should ingest independently verifiable evidence rather than relying only on a project description.

---

## Memory Risk

Persistent semantic memory can preserve useful historical knowledge, but it can also preserve:

- incorrect conclusions;
- stale assumptions;
- biased prior decisions.

Memory retrieval should therefore be evaluated and observable.

---

## Provenance Limitations

A recorded report hash proves integrity of a stored output.

It does not prove:

- factual correctness;
- security of an external protocol;
- quality of the evidence;
- correctness of the model's reasoning.

---

## Current Limitations

- The system is a due-diligence aid, not a formal audit.
- Public task text is weaker evidence than source code, tests, audits, and deployment configuration.
- Model behavior may vary across providers and versions.
- Semantic memory can propagate poor prior information.
- Deterministic safety checks cover selected patterns, not every possible failure mode.
