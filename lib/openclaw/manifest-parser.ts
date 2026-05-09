// ---------------------------------------------------------------------------
// ClawMind — OpenClaw Manifest Parser — Pipeline Config from openclaw.yaml
// ---------------------------------------------------------------------------
// Parses openclaw.yaml at startup and builds the pipeline configuration.
// The manifest is the single source of truth for:
//   - Which agents run (and in what order)
//   - Which model each agent uses
//   - Temperature, max_tokens, and other inference parameters
//   - Dependencies between agents (depends_on)
//   - Whether structured output validation is required
// ---------------------------------------------------------------------------
// If the manifest is invalid, the pipeline MUST NOT start.
// ---------------------------------------------------------------------------

import { promises as fs } from "fs";
import path from "path";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineStepConfig = {
  id: string;
  label: string;
  skill: string;
  model: string;
  temperature: number;
  maxTokens: number;
  dependsOn: string[];
  structuredOutput: boolean;
};

export type ModelConfig = {
  id: string;
  roles: string[];
  family: string;
};

export type ManifestConfig = {
  name: string;
  version: string;
  pipeline: PipelineStepConfig[];
  models: ModelConfig[];
  strategy: string;
  strategyDescription: string;
};

export type ManifestValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Manifest Loading & Parsing
// ---------------------------------------------------------------------------

let cachedConfig: ManifestConfig | null = null;
let cachedValidation: ManifestValidationResult | null = null;

function extractPipelineStep(
  stepData: Record<string, unknown>
): PipelineStepConfig {
  return {
    id: String(stepData.id ?? ""),
    label: String(stepData.label ?? ""),
    skill: String(stepData.skill ?? ""),
    model: String(stepData.model ?? "deepseek/deepseek-chat-v3-0324"),
    temperature: Number(stepData.temperature ?? 0.2),
    maxTokens: Number(stepData.max_tokens ?? 1200),
    dependsOn: Array.isArray(stepData.depends_on)
      ? stepData.depends_on.map(String)
      : [],
    structuredOutput: stepData.structured_output === true,
  };
}

function extractModelConfig(
  modelData: Record<string, unknown>
): ModelConfig {
  return {
    id: String(modelData.id ?? ""),
    roles: Array.isArray(modelData.roles)
      ? modelData.roles.map(String)
      : [],
    family: String(modelData.family ?? "unknown"),
  };
}

/**
 * Load and parse openclaw.yaml from the project root.
 * Results are cached for the lifetime of the process.
 */
export async function loadManifest(): Promise<ManifestConfig> {
  if (cachedConfig) return cachedConfig;

  const manifestPath = path.join(process.cwd(), "openclaw.yaml");
  const yamlText = await fs.readFile(manifestPath, "utf-8");
  const parsed = yaml.load(yamlText) as Record<string, unknown>;

  const orchestration = parsed.orchestration as Record<string, unknown> ?? {};
  const pipelineRaw = orchestration.pipeline as Record<string, unknown>[] ?? [];
  const zeroG = parsed.zero_g_integration as Record<string, unknown> ?? {};
  const compute = zeroG.compute as Record<string, unknown> ?? {};
  const modelsRaw = compute.models as Record<string, unknown>[] ?? [];

  const pipeline = pipelineRaw.map(extractPipelineStep);
  const models = modelsRaw.map(extractModelConfig);

  cachedConfig = {
    name: String(parsed.name ?? "clawmind"),
    version: String(parsed.version ?? "1.0.0"),
    pipeline,
    models,
    strategy: String(compute.strategy ?? "single_model"),
    strategyDescription: String(
      compute.strategy_description ?? "All agents use the same model."
    ),
  };

  return cachedConfig;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate the loaded manifest config.
 * Returns a result with valid/invalid flag and any errors/warnings.
 */
export function validateManifest(config: ManifestConfig): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have at least one pipeline step
  if (config.pipeline.length === 0) {
    errors.push("Pipeline is empty — no agents defined.");
  }

  // Check each step has required fields
  const stepIds = new Set<string>();
  for (const step of config.pipeline) {
    if (!step.id) {
      errors.push("Pipeline step missing 'id'.");
    } else {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate pipeline step id: '${step.id}'.`);
      }
      stepIds.add(step.id);
    }

    if (!step.skill) {
      errors.push(`Step '${step.id}' missing 'skill'.`);
    }

    if (!step.model) {
      warnings.push(`Step '${step.id}' has no model specified — will use default.`);
    }

    if (step.temperature < 0 || step.temperature > 2) {
      warnings.push(`Step '${step.id}' has unusual temperature: ${step.temperature}.`);
    }

    if (step.maxTokens < 0) {
      errors.push(`Step '${step.id}' has negative max_tokens: ${step.maxTokens}.`);
    }

    // Check depends_on references exist
    for (const dep of step.dependsOn) {
      if (!stepIds.has(dep)) {
        // We need to check against ALL ids, not just previously seen ones
        // So we do a second pass check below
      }
    }
  }

  // Second pass: verify all depends_on references
  const allIds = new Set(config.pipeline.map((s) => s.id));
  for (const step of config.pipeline) {
    for (const dep of step.dependsOn) {
      if (!allIds.has(dep)) {
        errors.push(
          `Step '${step.id}' depends_on '${dep}' which does not exist in pipeline.`
        );
      }
    }
  }

  // Check for cycles (simple DFS)
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(stepId: string): boolean {
    visited.add(stepId);
    inStack.add(stepId);
    const step = config.pipeline.find((s) => s.id === stepId);
    if (step) {
      for (const dep of step.dependsOn) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (inStack.has(dep)) {
          return true;
        }
      }
    }
    inStack.delete(stepId);
    return false;
  }

  for (const step of config.pipeline) {
    if (!visited.has(step.id)) {
      if (hasCycle(step.id)) {
        errors.push("Pipeline has circular dependencies.");
        break;
      }
    }
  }

  // Check model diversity (warn if all agents use the same model)
  const uniqueModels = new Set(config.pipeline.map((s) => s.model));
  if (uniqueModels.size === 1 && config.pipeline.length > 2) {
    warnings.push(
      "All agents use the same model — consider multi-model ensemble for diversity of reasoning."
    );
  }

  // Check that at least final_agent has structured_output
  const finalStep = config.pipeline.find((s) => s.id === "final_agent");
  if (finalStep && !finalStep.structuredOutput) {
    warnings.push(
      "final_agent does not have structured_output=true — report parsing may be unreliable."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Load and validate the manifest. Returns both config and validation result.
 * Throws if the manifest file cannot be read.
 */
export async function loadAndValidateManifest(): Promise<{
  config: ManifestConfig;
  validation: ManifestValidationResult;
}> {
  if (cachedConfig && cachedValidation) {
    return { config: cachedConfig, validation: cachedValidation };
  }

  const config = await loadManifest();
  const validation = validateManifest(config);

  cachedValidation = validation;

  if (!validation.valid) {
    console.error("[OpenClaw] Manifest validation FAILED:");
    for (const err of validation.errors) {
      console.error(`  ✗ ${err}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.warn("[OpenClaw] Manifest validation warnings:");
    for (const w of validation.warnings) {
      console.warn(`  ⚠ ${w}`);
    }
  }

  if (validation.valid) {
    console.log(
      `[OpenClaw] Manifest valid — ${config.pipeline.length} pipeline steps, ${config.models.length} models, strategy: ${config.strategy}`
    );
  }

  return { config, validation };
}

/**
 * Get the pipeline step config for a specific agent by id.
 */
export function getStepConfig(
  config: ManifestConfig,
  stepId: string
): PipelineStepConfig | undefined {
  return config.pipeline.find((s) => s.id === stepId);
}

/**
 * Get the model family for a given model id.
 */
export function getModelFamily(
  config: ManifestConfig,
  modelId: string
): string {
  const model = config.models.find((m) => m.id === modelId);
  return model?.family ?? "unknown";
}

/**
 * Get a short display name for a model (family + short id).
 * Example: "deepseek/deepseek-chat-v3-0324" → "DeepSeek"
 *           "qwen3.6-plus" → "Qwen"
 *           "zai-org/GLM-5-FP8" → "GLM-5"
 */
export function getModelDisplayName(modelId: string): string {
  if (modelId.includes("deepseek")) return "DeepSeek";
  if (modelId.includes("qwen")) return "Qwen";
  if (modelId.includes("GLM-5.1")) return "GLM-5.1";
  if (modelId.includes("GLM-5")) return "GLM-5";
  if (modelId === "local") return "Local";
  return modelId.split("/").pop()?.split("-")[0] ?? modelId;
}

/**
 * Invalidate the cache (useful for testing or hot-reload).
 */
export function invalidateManifestCache(): void {
  cachedConfig = null;
  cachedValidation = null;
}
