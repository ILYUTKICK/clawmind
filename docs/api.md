# API

ClawMind exposes application APIs for analysis, verification, report retrieval, and pipeline metadata.

Production base URL:

```text
https://clawmind-puce.vercel.app
```

---

## `POST /api/analyze`

Starts a ClawMind analysis.

Example:

```bash
curl -X POST https://clawmind-puce.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Review a read-only analytics dashboard with no custody or transaction signing."
  }'
```

The analysis path runs the reasoning pipeline and downstream proof/storage stages.

---

## `GET /api/judge`

Returns a public verification-oriented snapshot.

The endpoint is used by the application to expose runtime information such as:

- current registry configuration;
- pipeline/integration status;
- semantic-memory status;
- recent analyses;
- critic/runtime metrics.

The historical endpoint name is retained for compatibility with the deployed project.

---

## `GET /api/openclaw/manifest`

Returns the OpenClaw cognitive pipeline manifest.

YAML/default:

```bash
curl https://clawmind-puce.vercel.app/api/openclaw/manifest
```

JSON form:

```bash
curl "https://clawmind-puce.vercel.app/api/openclaw/manifest?format=json"
```

---

## `POST /api/report/retrieve`

Retrieves a previously stored report using storage metadata such as a 0G URI or root hash.

This separates report retrieval from the original analysis request.

---

## Receipt Page

Public receipt route:

```text
/receipt/[analysisId]
```

The page presents the stored/verifiable metadata associated with a completed analysis.

---

## Public Application Routes

Useful browser-facing surfaces include:

```text
/
 /analysis
 /stats
 /receipt/[analysisId]
```

A legacy `/judge` surface may still exist as a verification dashboard.

---

## API Design Principles

- keep analysis and verification endpoints separate;
- avoid returning private keys or secret environment values;
- return structured machine-readable output;
- preserve stable identifiers for completed analyses;
- keep verification metadata explicit rather than mixing it into free-form model text.
