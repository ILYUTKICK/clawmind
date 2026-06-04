# AnalysisRegistry Audit Notes

Date: 2026-06-04

Scope: `contracts/AnalysisRegistry.sol`

This is an internal Q1 static-analysis and manual-review pass for the deployed v4 signed registry. It is not an external security audit and does not replace a professional protocol audit.

## Summary

- Contract changes: none.
- Critical findings: none.
- High findings: none.
- Slither findings: 5 accepted findings documented in `docs/audits/analysis-registry-slither.md`.
- Foundry tests: 26 passing tests in `contracts/test/AnalysisRegistry.t.sol`.

## Reviewed Controls

| Area | Review result |
|---|---|
| Owner controls | Owner-only operator updates are enforced with `onlyOwner`; ownership transfer uses a two-step pending-owner flow and can be canceled. |
| Operator authentication | `recordAnalysis` recovers the signer from the EIP-712 digest and stores the recovered operator as `submitter`, so relayers cannot claim authorship. |
| Signature binding | The signed payload binds `taskHash`, `rootHash`, `score`, `storageUri`, `recommendation`, and `timestamp`; the domain binds name, version, chain ID, and verifying contract. |
| Replay resistance | Duplicate `rootHash` values are rejected; signatures expire after 5 minutes and cannot be too far in the future. |
| Signature malleability | The contract rejects invalid signature length, invalid `v`, high-`s` signatures, and zero recovered signer. |
| Input bounds | Zero task/root hashes, scores above 100, invalid recommendations, empty/non-`0g://` URIs, oversized URIs, and oversized batch reads are rejected. |
| Rate limiting | Submissions are rate-limited per recovered operator, not per relayer. |
| Read APIs | Single-record, latest-record, auth, and bounded batch reads are covered by tests. |

## Accepted Risks

| Risk | Rationale |
|---|---|
| Timestamp-dependent checks | Used only for anti-spam and signature freshness. There is no value transfer, liquidation, randomness, or price-sensitive execution path. |
| Exact equality in rate-limit boundary | The `lastSubmission == 0` branch is a sentinel for first submission. Allowing the exact boundary at 60 seconds is intended. |
| Inline assembly for signature decoding | The assembly block only reads `r`, `s`, and `v` after requiring a 65-byte signature. Follow-up checks cover malformed signatures. |
| Broad Solidity pragma | The build profile pins `solc_version = "0.8.20"`. A future redeploy can tighten the pragma without changing deployed v4 behavior. |

## Follow-Up Policy

Do not redeploy the registry for informational findings alone. A Solidity change should happen only if a concrete vulnerability is found, and must include:

- a targeted Foundry regression test;
- a fresh Slither run;
- updated deployment address and block env vars;
- README and contract-history updates.
