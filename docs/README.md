# ClawMind Documentation

This directory contains the extended technical documentation for ClawMind.

The root `README.md` is intentionally short and portfolio-oriented. Detailed implementation notes, verification flows, agent responsibilities, evaluation scenarios, and deployment guidance live here.

## Contents

- [Architecture](architecture.md) — system layers, orchestration, data flow, and design rationale
- [Agents](agents.md) — responsibilities and interfaces of the specialized reasoning agents
- [Memory](memory.md) — semantic retrieval, embeddings, persistence, and warm-up
- [Evaluation](evaluation.md) — scenario-based evaluation and critic-driven scoring
- [MCP](mcp.md) — Model Context Protocol server and tools
- [API](api.md) — public application endpoints
- [Verification](verification.md) — report provenance, storage, signatures, and on-chain registry
- [Deployment](deployment.md) — local setup, Docker, Vercel, and production configuration
- [Security](security.md) — safety model, smart-contract checks, and known limitations
- [Development](development.md) — quality gates, tests, CI, and repository workflows
- [Demo](demo.md) — concise end-to-end product walkthrough

## Screenshots

Portfolio screenshots can be stored in:

```text
docs/images/
├── analysis.png
├── critic.png
└── receipt.png
```

The documentation links use relative paths so the files render correctly on GitHub.
