import assert from "node:assert/strict";
import test from "node:test";
import {
  validateManifest,
  type ManifestConfig,
} from "../../lib/openclaw/manifest-parser";

function createManifest(overrides: Partial<ManifestConfig> = {}): ManifestConfig {
  return {
    name: "clawmind",
    version: "2.0.0",
    models: [
      {
        id: "deepseek/deepseek-chat-v3-0324",
        roles: ["planner", "final_agent"],
        family: "deepseek",
      },
    ],
    strategy: "single_primary_model_route",
    strategyDescription: "Stable single model route.",
    pipeline: [
      {
        id: "planner",
        label: "Planner",
        skill: "task-decomposition",
        model: "deepseek/deepseek-chat-v3-0324",
        temperature: 0.2,
        maxTokens: 800,
        dependsOn: [],
        structuredOutput: true,
      },
      {
        id: "researcher",
        label: "Researcher",
        skill: "research-extraction",
        model: "deepseek/deepseek-chat-v3-0324",
        temperature: 0.2,
        maxTokens: 800,
        dependsOn: ["planner"],
        structuredOutput: true,
      },
      {
        id: "final_agent",
        label: "Final",
        skill: "decision-synthesis",
        model: "deepseek/deepseek-chat-v3-0324",
        temperature: 0.1,
        maxTokens: 1200,
        dependsOn: ["researcher"],
        structuredOutput: true,
      },
    ],
    ...overrides,
  };
}

test("validateManifest accepts a coherent pipeline and warns on single-model routing", () => {
  const result = validateManifest(createManifest());

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("same model")));
});

test("validateManifest rejects missing dependencies", () => {
  const result = validateManifest(
    createManifest({
      pipeline: [
        {
          id: "final_agent",
          label: "Final",
          skill: "decision-synthesis",
          model: "deepseek/deepseek-chat-v3-0324",
          temperature: 0.1,
          maxTokens: 1200,
          dependsOn: ["missing_step"],
          structuredOutput: true,
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("missing_step")));
});

test("validateManifest rejects circular dependencies", () => {
  const result = validateManifest(
    createManifest({
      pipeline: [
        {
          id: "a",
          label: "A",
          skill: "a",
          model: "model-a",
          temperature: 0.1,
          maxTokens: 100,
          dependsOn: ["b"],
          structuredOutput: true,
        },
        {
          id: "b",
          label: "B",
          skill: "b",
          model: "model-b",
          temperature: 0.1,
          maxTokens: 100,
          dependsOn: ["a"],
          structuredOutput: true,
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Pipeline has circular dependencies."));
});
