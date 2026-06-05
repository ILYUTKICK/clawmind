import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalysisTraceSummary } from "@/lib/metrics/analysis-metrics";
import type { AgentStep } from "@/lib/types";

test("buildAnalysisTraceSummary records latency and provider breakdown", () => {
  const steps: AgentStep[] = [
    {
      name: "planner",
      label: "Planner Agent",
      status: "completed",
      input: "task",
      output: "plan",
      startedAt: "2026-06-05T10:00:00.000Z",
      finishedAt: "2026-06-05T10:00:01.500Z",
      model: "deepseek/deepseek-chat-v3-0324",
      modelFamily: "0G Compute",
      provider: "0G_COMPUTE",
      costStatus: "not_reported",
    },
    {
      name: "report_storage",
      label: "Report Storage",
      status: "completed",
      inputChars: 120,
      outputChars: 80,
      durationMs: 700,
      model: "0G Storage",
      modelFamily: "0G Storage",
      provider: "0G_STORAGE",
      costStatus: "not_reported",
    },
    {
      name: "onchain_registry",
      label: "On-chain Registry",
      status: "failed",
      durationMs: 2_000,
      error: "Registry not configured",
      provider: "NOT_CONFIGURED",
      costStatus: "not_reported",
    },
  ];

  const summary = buildAnalysisTraceSummary(steps);

  assert.equal(summary.completedSteps, 2);
  assert.equal(summary.failedSteps, 1);
  assert.equal(summary.totalDurationMs, 4_200);
  assert.equal(summary.providerBreakdown["0G_COMPUTE"], 1);
  assert.equal(summary.providerBreakdown["0G_STORAGE"], 1);
  assert.equal(summary.providerBreakdown.NOT_CONFIGURED, 1);
  assert.equal(summary.slowestStep?.name, "onchain_registry");
  assert.equal(summary.steps[0]?.durationMs, 1_500);
  assert.equal(summary.steps[0]?.inputChars, 4);
  assert.equal(summary.steps[0]?.outputChars, 4);
});
