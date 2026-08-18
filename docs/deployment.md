# Deployment

This document covers local development, Docker, production environment variables, Vercel deployment, and registry deployment.

---

## Requirements

```text
Node.js >= 18.18
npm
```

Smart-contract work additionally requires Foundry.

---

## Local Setup

```bash
git clone https://github.com/ILYUTKICK/clawmind.git
cd clawmind

npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Docker

Build:

```bash
docker build -t clawmind .
```

Run:

```bash
docker run --env-file .env -p 3000:3000 clawmind
```

The container runs the Next.js application. External compute, storage, registry, and Redis-backed features still require the relevant environment variables.

---

## Production Environment

Core production variables currently documented by the project include:

```bash
ZERO_G_NETWORK=mainnet
ZERO_G_COMPUTE_ENDPOINT=https://router-api.0g.ai/v1/chat/completions
ZERO_G_COMPUTE_API_KEY=...
ZERO_G_COMPUTE_MODEL=deepseek/deepseek-chat-v3-0324

ZERO_G_STORAGE_ENABLED=true
ZERO_G_STORAGE_PRIVATE_KEY=...

ZERO_G_ANALYSIS_REGISTRY_ADDRESS=...
ZERO_G_ANALYSIS_REGISTRY_DEPLOY_BLOCK=...
ZERO_G_ALLOW_LEGACY_REGISTRY_WRITES=false

CLAWMIND_ANALYZE_RATE_LIMIT_SECONDS=60
CLAWMIND_MEMORY_LIMIT=200
```

Never commit populated production secrets.

Use `.env.example` for variable names and safe examples only.

---

## Vercel

The repository includes:

```text
vercel.json
```

The live application is currently deployed on Vercel.

Before production deployment:

```bash
npm run ci
npm run ci:mcp
```

Production secrets should be configured through the deployment environment, not the repository.

---

## MCP Deployment

The MCP server lives in:

```text
apps/mcp-server/
```

Validate it before deployment:

```bash
npm run ci:mcp
```

Production endpoint:

```text
https://clawmind-mcp.vercel.app/mcp
```

---

## Registry Deployment

Initialize contract dependencies:

```bash
git submodule update --init --recursive
```

Deploy using the project script:

```bash
node scripts/deploy-registry.mjs
```

After deployment:

1. update `ZERO_G_ANALYSIS_REGISTRY_ADDRESS`;
2. set `ZERO_G_ANALYSIS_REGISTRY_DEPLOY_BLOCK`;
3. confirm the deployer/operator configuration;
4. verify production has legacy writes disabled;
5. run the contract tests and static analysis.

---

## Post-Deployment Checks

### Application

```bash
curl https://clawmind-puce.vercel.app/api/judge
```

### Manifest

```bash
curl "https://clawmind-puce.vercel.app/api/openclaw/manifest?format=json"
```

### MCP

Confirm the MCP server accepts a properly identified client.

### Analysis

Run one deliberately low-risk and one high-risk evaluation scenario.

### Receipt

Confirm a completed analysis has:

- stored report metadata;
- registry information;
- a public receipt;
- consistent report hashes.
