# AnalysisRegistry Slither Report

Date: 2026-06-04

Scope: `contracts/AnalysisRegistry.sol`

Tooling:

- Slither `0.11.5`
- Foundry `1.7.1`
- Solidity compiler `0.8.20` through `contracts/foundry.toml`

Command:

```bash
uvx --from slither-analyzer slither . --exclude-dependencies --filter-paths lib
```

Result: Slither completed successfully and reported 5 findings. No critical or high impact issues were found. All reported findings are documented accepted findings for the current v4 registry design.

| Detector | Impact / Confidence | Location | Disposition |
|---|---|---|---|
| `incorrect-equality` | Medium / High | `AnalysisRegistry._enforceRateLimit` | Accepted. The equality is the zero-value sentinel for first submission; the time boundary intentionally allows submission at exactly `lastSubmission + RATE_LIMIT_INTERVAL`. |
| `timestamp` | Low / Medium | `AnalysisRegistry._enforceRateLimit` | Accepted. Timestamp drift affects only a 60 second anti-spam gate and does not transfer value or change authorization. |
| `timestamp` | Low / Medium | `AnalysisRegistry._validateSignatureTimestamp` | Accepted. The timestamp is part of the signed EIP-712 payload and is bounded by a 5 minute validity window plus 30 second future tolerance. |
| `assembly` | Informational / High | `AnalysisRegistry._recoverSigner` | Accepted. Inline assembly only decodes a 65-byte signature into `r`, `s`, and `v`; length, `v`, low-`s`, and nonzero signer are checked and covered by tests. |
| `solc-version` | Informational / High | `pragma solidity ^0.8.20` | Accepted. Foundry pins compilation to `0.8.20` in `contracts/foundry.toml`; production deployment used the pinned compiler profile. |

Validation after scan:

```bash
cd contracts && forge test -vv
```

Result: 26 tests passed, 0 failed, 0 skipped.
