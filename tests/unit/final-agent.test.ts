import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportFromModelOutput,
  type FinalAgentInput,
} from "../../lib/agents/final-agent";

function createInput(overrides: Partial<FinalAgentInput>): FinalAgentInput {
  return {
    task: "Review a Web3 project with incomplete documentation.",
    memories: [],
    plan: "Check product scope, risks, architecture, and decision criteria.",
    researchOutput: "The project has limited public evidence.",
    riskOutput: "Evidence completeness and operational safeguards need review.",
    architectureOutput: "Keep execution permissions outside LLM reasoning.",
    critiqueOutput: {
      challenges: [],
      summary: "No material critic challenges.",
    },
    ...overrides,
  };
}

const optimisticModelOutput = JSON.stringify({
  summary: "The project looks excellent.",
  score: 95,
  recommendation: "GO",
  risks: [
    {
      title: "Minor documentation cleanup",
      severity: "low",
      explanation: "Some docs could be clearer.",
    },
  ],
  opportunities: ["Reusable due-diligence automation."],
  architecture: ["Use a multi-agent analysis pipeline."],
  nextSteps: ["Run an evidence review."],
  evidence: ["Model claims high confidence."],
});

test("buildReportFromModelOutput forces high-risk custody tasks to NO_GO", () => {
  const report = buildReportFromModelOutput(
    createInput({
      task: "Self-custodial agent that auto-trades user funds with no withdrawal guards and a private key in an env var.",
      researchOutput: "The task explicitly mentions user funds, auto-trading, no withdrawal guards, and private key material in an env var.",
      riskOutput: "Direct custody and exposed signing material create a fund-loss path.",
      critiqueOutput: {
        challenges: [
          {
            challenge: "Private key material controls user funds",
            severity: "high",
            explanation: "The agent can sign for user funds while the key is exposed.",
          },
        ],
        summary: "Direct custody risk remains unresolved.",
      },
    }),
    optimisticModelOutput,
  );

  assert.equal(report.recommendation, "NO_GO");
  assert.ok(report.score >= 10 && report.score <= 34);
  assert.ok(report.criticAdjustment);
  assert.equal(report.criticAdjustment.unresolvedHigh, 1);
});

test("buildReportFromModelOutput keeps mature safe protocols in the GO band", () => {
  const report = buildReportFromModelOutput(
    createInput({
      task: "Mature Uniswap V3 fork on Base, $60M TVL, two independent audits, non-custodial pools, no external oracle dependency, doxxed team, active governance, 7-day timelock, and no admin keys.",
      researchOutput: "The task states two independent audits, high TVL, non-custodial design, no external oracle, active governance, and timelock.",
      riskOutput: "Residual risks are fork-diff verification and governance monitoring.",
      critiqueOutput: {
        challenges: [
          {
            challenge: "Audit scope should be verified",
            severity: "low",
            explanation: "The audit should cover the exact fork diff.",
          },
        ],
        summary: "Only bounded verification remains.",
      },
    }),
    JSON.stringify({
      ...JSON.parse(optimisticModelOutput),
      score: 30,
      recommendation: "NO_GO",
    }),
  );

  assert.equal(report.recommendation, "GO");
  assert.ok(report.score >= 75);
  assert.ok(report.risks.every((risk) => risk.severity !== "high" && risk.severity !== "critical"));
});

test("buildReportFromModelOutput bounds novel AMM tasks to INVESTIGATE_MORE", () => {
  const report = buildReportFromModelOutput(
    createInput({
      task: "New AMM with novel TWAP oracle, audited by 1 firm, $5M TVL, anonymous team.",
      researchOutput: "The design has a novel TWAP oracle, one audit, $5M TVL, and anonymous team.",
      riskOutput: "Oracle manipulation and limited validation remain material.",
      critiqueOutput: {
        challenges: [
          {
            challenge: "Novel TWAP oracle needs adversarial market testing",
            severity: "medium",
            explanation: "Manipulation resistance is not proven.",
          },
        ],
        summary: "Investigate before approving.",
      },
    }),
    optimisticModelOutput,
  );

  assert.equal(report.recommendation, "INVESTIGATE_MORE");
  assert.ok(report.score >= 35 && report.score <= 69);
});
