// ---------------------------------------------------------------------------
// ClawMind — Model Router
// ---------------------------------------------------------------------------
// Selects the optimal 0G Compute model for each agent based on:
//   - Agent complexity (simple agents → fast model, complex → capable model)
//   - Reliability (skip known-unstable models)
//   - Fallback chain if primary model fails
// ---------------------------------------------------------------------------

export type ModelConfig = {
  model: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
};

// Available 0G Compute models (ranked by speed + reliability)
const MODELS = {
  // Primary: fast + reliable
  deepseek: "deepseek/deepseek-chat-v3-0324",
  // Alternative: GLM-5 (fast, good for structured output)
  glm5: "zai-org/GLM-5-FP8",
  // Alternative: GLM-5.1 (newer)
  glm51: "zai-org/GLM-5.1-FP8",
  // UNSTABLE - do not use as primary: qwen3.6-plus
  // qwen: "qwen3.6-plus",  // frequent "Service Unavailable" errors
} as const;

// Per-agent model configuration
// Strategy: use the fastest reliable model for most agents,
// reserve the most capable model for the final agent
const AGENT_MODELS: Record<string, ModelConfig> = {
  memory_retrieval: {
    model: MODELS.deepseek,
    maxTokens: 600,
    timeoutMs: 15_000,
    temperature: 0.1,
  },
  planner: {
    model: MODELS.deepseek,
    maxTokens: 800,
    timeoutMs: 20_000,
    temperature: 0.2,
  },
  researcher: {
    model: MODELS.deepseek,
    maxTokens: 800,
    timeoutMs: 20_000,
    temperature: 0.2,
  },
  risk_agent: {
    model: MODELS.deepseek,
    maxTokens: 800,
    timeoutMs: 20_000,
    temperature: 0.2,
  },
  architect: {
    model: MODELS.deepseek,
    maxTokens: 800,
    timeoutMs: 20_000,
    temperature: 0.2,
  },
  critic: {
    model: MODELS.deepseek,
    maxTokens: 800,
    timeoutMs: 20_000,
    temperature: 0.3,
  },
  final_agent: {
    model: MODELS.glm5,  // GLM-5 is better for structured JSON output
    maxTokens: 1500,
    timeoutMs: 30_000,
    temperature: 0.1,
  },
  report_storage: {
    model: MODELS.deepseek,
    maxTokens: 300,
    timeoutMs: 10_000,
    temperature: 0.1,
  },
  memory_writer: {
    model: MODELS.deepseek,
    maxTokens: 600,
    timeoutMs: 15_000,
    temperature: 0.1,
  },
  memory_index: {
    model: MODELS.deepseek,
    maxTokens: 300,
    timeoutMs: 10_000,
    temperature: 0.1,
  },
  onchain_registry: {
    model: MODELS.deepseek,
    maxTokens: 300,
    timeoutMs: 10_000,
    temperature: 0.1,
  },
};

// Fallback chain: if primary model fails, try these in order
const FALLBACK_CHAINS: Record<string, string[]> = {
  [MODELS.deepseek]: [MODELS.glm5, MODELS.glm51],
  [MODELS.glm5]: [MODELS.deepseek, MODELS.glm51],
  [MODELS.glm51]: [MODELS.deepseek, MODELS.glm5],
};

export function getModelForAgent(agentName: string): ModelConfig {
  // Allow env override for all models
  const envModel = process.env.ZERO_G_COMPUTE_MODEL;
  if (envModel && envModel.trim().length > 0) {
    const baseConfig = AGENT_MODELS[agentName] ?? AGENT_MODELS.final_agent;
    return {
      ...baseConfig,
      model: envModel,
    };
  }

  return AGENT_MODELS[agentName] ?? AGENT_MODELS.planner;
}

export function getFallbackModel(primaryModel: string): string | null {
  const chain = FALLBACK_CHAINS[primaryModel];
  if (!chain || chain.length === 0) return null;
  return chain[0];
}

export function getFallbackChain(primaryModel: string): string[] {
  return FALLBACK_CHAINS[primaryModel] ?? [];
}
