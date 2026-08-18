# Development

This document describes the repository quality gates and development workflow.

## Root Quality Commands

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run typecheck
```

### Unit Tests

```bash
npm run test:unit
```

### Contract Tests

```bash
npm run test:contracts
```

### Full Test Suite

```bash
npm test
```

### Production Build

```bash
npm run build
```

CI-specific build:

```bash
npm run build:ci
```

### Main CI Gate

```bash
npm run ci
```

The current root CI command runs:

```text
lint
production build
TypeScript typecheck
unit tests
contract tests
```

---

## MCP Quality Gate

```bash
npm run ci:mcp
```

This combines:

```text
MCP lint
MCP TypeScript checks
MCP build
```

---

## Contract Audit

```bash
npm run audit:contracts
```

This runs the smart-contract static-analysis workflow and Foundry tests.

Audit notes are stored under:

```text
docs/audits/
```

---

## Recommended Pre-Commit / Pre-PR Checks

For application-only changes:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

For changes that affect the full app:

```bash
npm run ci
```

For MCP changes:

```bash
npm run ci:mcp
```

For contract changes:

```bash
npm run audit:contracts
```

---

## Testing Priorities

When changing the agent pipeline, add coverage for:

- structured-output parsing;
- critic challenge normalization;
- score/recommendation behavior;
- deterministic safety rules;
- malformed model responses.

When changing memory, add coverage for:

- embedding fallback;
- similarity ranking;
- persistence;
- empty-memory cold start.

When changing public interfaces, add coverage for:

- API contracts;
- MCP tool schemas;
- receipt consistency;
- rate limiting.

---

## Repository Hygiene

The root should stay focused on executable project files.

Long-form documentation belongs in `docs/`.

Recommended root structure:

```text
.github/
app/
apps/
components/
contracts/
docs/
lib/
public/
scripts/
tests/

.dockerignore
.env.example
.gitignore
.gitmodules
Dockerfile
README.md
eslint.config.mjs
next.config.ts
openclaw.yaml
package.json
package-lock.json
postcss.config.mjs
tsconfig.json
vercel.json
```

Move long demo instructions from the root into:

```text
docs/demo.md
```
