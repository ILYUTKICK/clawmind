import assert from "node:assert/strict";
import test from "node:test";
import { extractCriticJson } from "../../lib/agents/critic";

test("extractCriticJson accepts fenced JSON and normalizes fields", () => {
  const parsed = extractCriticJson(`
    \`\`\`json
    {
      "challenges": [
        { "challenge": "Missing oracle tests", "severity": "urgent", "explanation": "" },
        { "challenge": "Admin key unclear", "severity": "HIGH", "explanation": "Governance controls are not proven." },
      ],
      "summary": ""
    }
    \`\`\`
  `);

  assert.ok(parsed);
  assert.equal(parsed.challenges.length, 2);
  assert.equal(parsed.challenges[0].severity, "medium");
  assert.equal(
    parsed.challenges[0].explanation,
    "The critic flagged this as a material issue requiring reconciliation.",
  );
  assert.equal(parsed.challenges[1].severity, "high");
  assert.equal(parsed.summary, "Critic found material challenges.");
});

test("extractCriticJson returns null when no JSON object is present", () => {
  assert.equal(extractCriticJson("plain prose without a JSON object"), null);
});
