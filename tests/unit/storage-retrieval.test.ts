import assert from "node:assert/strict";
import test from "node:test";
import { saveReportToZeroGStorage } from "../../lib/storage/zero-g-storage";
import {
  extractRootHash,
  retrieveReportFromZeroGStorage,
} from "../../lib/storage/zero-g-retrieval";
import type { AnalysisReport } from "../../lib/types";

const report: AnalysisReport = {
  summary: "A bounded report for storage tests.",
  score: 61,
  recommendation: "INVESTIGATE_MORE",
  risks: [
    {
      title: "Evidence completeness",
      severity: "medium",
      explanation: "The project needs more source evidence.",
    },
  ],
  opportunities: ["Reusable verification trail."],
  architecture: ["Persist report JSON before on-chain anchoring."],
  nextSteps: ["Collect source documents."],
  evidence: ["Unit test fixture."],
};

test("extractRootHash handles 0g URIs and raw roots", () => {
  assert.equal(
    extractRootHash("0g://0xabc123?tx=0xdeadbeef"),
    "0xabc123",
  );
  assert.equal(extractRootHash("0xbeef?ignored=true"), "0xbeef");
  assert.throws(() => extractRootHash(""), /required/);
});

test("saveReportToZeroGStorage returns a local fallback receipt when storage is disabled", async () => {
  const previousEnabled = process.env.ZERO_G_STORAGE_ENABLED;
  const previousPrivateKey = process.env.ZERO_G_STORAGE_PRIVATE_KEY;

  process.env.ZERO_G_STORAGE_ENABLED = "false";
  delete process.env.ZERO_G_STORAGE_PRIVATE_KEY;

  try {
    const receipt = await saveReportToZeroGStorage({
      task: "Review a protocol without making network calls.",
      report,
    });

    assert.equal(receipt.provider, "LOCAL_FALLBACK");
    assert.match(receipt.reportHash, /^0x[0-9a-f]+$/);
    assert.ok(receipt.storageUri?.startsWith("local://clawmind/reports/"));
  } finally {
    process.env.ZERO_G_STORAGE_ENABLED = previousEnabled;
    process.env.ZERO_G_STORAGE_PRIVATE_KEY = previousPrivateKey;
  }
});

test("retrieveReportFromZeroGStorage validates and returns stored report JSON", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);

    return new Response(
      JSON.stringify({
        kind: "CLAWMIND_ANALYSIS_REPORT",
        version: "0.1",
        task: "Review a stored report.",
        report,
        createdAt: "2026-06-03T00:00:00.000Z",
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }) as typeof fetch;

  try {
    const result = await retrieveReportFromZeroGStorage("0g://0x1234?tx=0xabcd");

    assert.ok(requestedUrl.includes("root=0x1234"));
    assert.equal(result.rootHash, "0x1234");
    assert.equal(result.task, "Review a stored report.");
    assert.equal(result.report.score, 61);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
