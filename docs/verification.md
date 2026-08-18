# Verification and Provenance

ClawMind separates model reasoning from report provenance.

The verification layer answers:

> Was this exact report stored and recorded?

It does **not** answer:

> Was the model conclusion factually correct?

That distinction is fundamental to the project.

---

## Verification Flow

```text
Final Agent
    |
    v
Structured Report
    |
    +--> 0G Storage
    |
    +--> Persistent Memory
    |
    +--> Analysis Registry
             |
             v
        Signed Receipt
```

---

## 0G Integration

The current project uses 0G infrastructure for several roles.

| Component | Role |
|---|---|
| 0G Compute | Agent inference routing |
| 0G Storage | Final report storage |
| 0G Storage | Persistent memory index |
| 0G Chain | Signed analysis registry |
| OpenClaw manifest | Declares the cognitive pipeline and policies |

---

## Current Registry

The production README historically points to the current signed registry:

```text
0x24bAAC6720ae5B01A1CC90eCC1C15AFcb903E121
```

Current production deployment metadata documented by the project:

```text
Deploy block:
34500039

Deploy tx:
0xb8c14d110aa5496e4a4d83891bea0ea0670161d92161c58b886c1823a98b9e48

Initial operator:
0x9A0C8040A8C6aB9F65F544578b891Fba599799F8
```

If production is redeployed, update this documentation together with the application environment.

---

## Registry History

Historical versions:

| Version | Address | Purpose |
|---|---|---|
| v4 | `0x24bAAC6720ae5B01A1CC90eCC1C15AFcb903E121` | Current signed registry |
| v3 | `0x08a9c275f5d0764a32f9dda4f50ba6f9a828e2b1` | Earlier signed registry |
| v2 | `0x01c9d988cbC2c369CB18B952C01a5Da05bF034D2` | Earlier open-write registry |
| v1 | `0x8d53153a8a25c81701954eed66154b3ebba8b8c7` | Initial prototype |

Production should point only to the current signed registry.

---

## EIP-712 Operator Authentication

The current registry flow uses signed typed data so writes can be associated with an authorized operator.

The current version binds important analysis fields such as:

- task hash;
- report/root hash;
- score;
- recommendation;
- storage URI;
- timestamp.

This prevents treating arbitrary open writes as authenticated ClawMind results.

---

## Verification Checklist

For a completed analysis, verify:

1. **Report storage**
   - a storage receipt/root hash exists;
   - the report can be retrieved.

2. **Registry**
   - the analysis appears in the configured registry;
   - the registry address matches production configuration.

3. **Operator**
   - the write is marked as signed/operator-authenticated;
   - the expected operator signature is present.

4. **Integrity**
   - the report hash shown by the application matches the recorded hash.

5. **Pipeline**
   - the analysis includes the expected reasoning and proof stages.

6. **Memory**
   - the semantic retrieval/persistence subsystem reports an active state when configured.

---

## Public Verification Surfaces

Production includes public surfaces for inspecting:

- recent analyses;
- current integration status;
- memory metrics;
- critic activity;
- registry state;
- signed receipts.

The application routes and JSON APIs should be preferred over hard-coded screenshots when verifying current state.

---

## What Verification Does Not Prove

A valid receipt does not prove:

- the user task was complete;
- the evidence was accurate;
- the LLM reasoning was correct;
- the recommendation was safe;
- an external project is secure.

It proves only the integrity/provenance claims implemented by the storage and registry layer.
