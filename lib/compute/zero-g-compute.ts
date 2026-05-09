// ---------------------------------------------------------------------------
// ClawMind — 0G Compute Provider with Multi-Model Routing + Auto-Fallback
// ---------------------------------------------------------------------------
// Routes each agent to its designated model as defined in openclaw.yaml.
// Supports the diversity-of-reasoning strategy: different model families
// for different agent roles to reduce correlated errors.
//
// FALLBACK CHAIN:
//   1. Try the manifest-specified model
//   2. If it fails (Service Unavailable, empty content, network error),
//      try the fallback_model from manifest (if specified)
//   3. If that also fails, try models from the fallback_chain in order
//   4. If ALL remote models fail, use local deterministic fallback
// ---------------------------------------------------------------------------

type InferenceInput = {
  agentName: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Fallback model from manifest (per-agent) */
  fallbackModel?: string;
  /** Full fallback chain from manifest (global) */
  fallbackChain?: string[];
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

// Default model configuration
const DEFAULT_MODEL = "deepseek/deepseek-chat-v3-0324";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1200;

// Global fallback chain — used when per-agent fallback is also unavailable
const GLOBAL_FALLBACK_CHAIN = [
  "deepseek/deepseek-chat-v3-0324",
  "zai-org/GLM-5-FP8",
  "qwen3.6-plus",
];

function getComputeConfig() {
  const endpoint = process.env.ZERO_G_COMPUTE_ENDPOINT;
  const apiKey = process.env.ZERO_G_COMPUTE_API_KEY;
  const model = process.env.ZERO_G_COMPUTE_MODEL || DEFAULT_MODEL;

  const isConfigured =
    typeof endpoint === "string" &&
    endpoint.trim().length > 0 &&
    typeof apiKey === "string" &&
    apiKey.trim().length > 0 &&
    apiKey !== "your_0g_router_api_key_here";

  return {
    endpoint,
    apiKey,
    model,
    isConfigured,
  };
}

/**
 * Attempt a single inference call to 0G Compute with a specific model.
 * Returns the raw content string, or null if the call failed.
 */
async function tryInference(
  config: ReturnType<typeof getComputeConfig>,
  input: InferenceInput,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<{ content: string | null; error: string | null }> {
  try {
    const response = await fetch(config.endpoint as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: input.systemPrompt,
          },
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    // Handle non-JSON responses (e.g. "Service Unavailable")
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return {
        content: null,
        error: `${model} returned non-JSON (${response.status}): ${text.slice(0, 100)}`,
      };
    }

    const data = (await response.json()) as OpenAICompatibleResponse;

    if (!response.ok) {
      const errMsg = data.error?.message || response.statusText;
      return {
        content: null,
        error: `${model} HTTP ${response.status}: ${errMsg}`,
      };
    }

    const content = data.choices?.[0]?.message?.content;

    if (typeof content === "string" && content.trim().length > 0) {
      console.log(
        `[0G Compute] ${input.agentName} → ${model} ✓ (${content.length} chars)`
      );
      return { content: content.trim(), error: null };
    }

    return {
      content: null,
      error: `${model} returned empty content`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: null,
      error: `${model} exception: ${message}`,
    };
  }
}

/**
 * Run inference through 0G Compute Router with automatic model fallback.
 *
 * Model resolution order:
 * 1. Primary model (from manifest or explicit parameter)
 * 2. Per-agent fallback_model (from manifest)
 * 3. Global fallback_chain (from manifest or default)
 * 4. Local deterministic fallback (last resort)
 */
export async function runInference(input: InferenceInput): Promise<string> {
  const config = getComputeConfig();

  if (!config.isConfigured) {
    return runLocalFallbackInference(input);
  }

  const primaryModel = input.model || config.model;
  const temperature = input.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
  const fallbackChain = input.fallbackChain ?? GLOBAL_FALLBACK_CHAIN;

  // Build the ordered list of models to try
  const modelsToTry: string[] = [primaryModel];

  // Add per-agent fallback model (skip if same as primary)
  if (input.fallbackModel && input.fallbackModel !== primaryModel) {
    modelsToTry.push(input.fallbackModel);
  }

  // Add global fallback chain models (skip duplicates)
  for (const fallbackModel of fallbackChain) {
    if (!modelsToTry.includes(fallbackModel)) {
      modelsToTry.push(fallbackModel);
    }
  }

  // Try each model in order
  const failures: string[] = [];

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const isPrimary = i === 0;

    const result = await tryInference(
      config,
      input,
      model,
      temperature,
      maxTokens
    );

    if (result.content !== null) {
      // Success!
      if (!isPrimary) {
        console.log(
          `[0G Compute] ${input.agentName} — fell back from ${primaryModel} → ${model}`
        );
      }
      return result.content;
    }

    // Failed — log and continue to next model
    failures.push(result.error ?? `${model}: unknown error`);
    console.warn(`[0G Compute] ${input.agentName} (${model}) failed: ${result.error}`);
  }

  // All remote models failed — use local deterministic fallback
  console.warn(
    `[0G Compute] ${input.agentName} — ALL ${modelsToTry.length} model(s) failed. Using local fallback.`
  );
  for (const failure of failures) {
    console.warn(`  ✗ ${failure}`);
  }

  return runLocalFallbackInference(input);
}

function runLocalFallbackInference(input: InferenceInput): string {
  const normalizedPrompt = `${input.systemPrompt}\n${input.userPrompt}`.toLowerCase();

  if (input.agentName === "planner") {
    return [
      "1. Identify the product goal and target user.",
      "2. Extract technical assumptions from the project description.",
      "3. Analyze security, financial, autonomy, and infrastructure risks.",
      "4. Propose an architecture using modular agents, 0G Compute, and 0G Storage.",
      "5. Critique weak points and missing safeguards.",
      "6. Generate a final go/no-go recommendation with a score.",
    ].join("\n");
  }

  if (input.agentName === "researcher") {
    return [
      "Extracted facts:",
      "- The project is Web3/AI-oriented.",
      "- The system benefits from autonomous reasoning and persistent context.",
      "- The product may touch security-sensitive or financial workflows.",
      "- The project should demonstrate state persistence and long-context memory.",
      "",
      "Assumptions:",
      "- Users need repeatable decision support instead of one-off chatbot answers.",
      "- Prior analysis records can improve future risk detection.",
    ].join("\n");
  }

  if (input.agentName === "risk_agent") {
    const defiRisk = normalizedPrompt.includes("defi")
      ? "- Oracle manipulation and yield-data integrity risk."
      : "- External data quality and source coverage risk.";

    return [
      "Risk findings:",
      "- Autonomous execution risk: wrong model outputs may trigger unsafe decisions.",
      "- Custody and permission risk: signing access or delegated wallets require strict controls.",
      defiRisk,
      "- Memory poisoning risk: persistent memory can bias future decisions if not validated.",
      "- Overconfidence risk: the system must expose uncertainty and evidence.",
    ].join("\n");
  }

  if (input.agentName === "architect") {
    return [
      "Architecture proposal:",
      "- Use a modular pipeline: Memory Retrieval → Planner → Researcher → Risk Agent → Architect → Critic → Final Agent.",
      "- Use 0G Compute as the inference layer for every specialized agent node.",
      "- Use 0G Storage for reports, memory summaries, and pipeline execution logs.",
      "- Store report hashes and storage references as decision receipts.",
      "- Keep execution permissions deterministic and outside the LLM reasoning layer.",
    ].join("\n");
  }

  if (input.agentName === "critic") {
    return [
      "Critique:",
      "- The product must not look like a simple chatbot.",
      "- The demo should clearly show memory reuse across analysis runs.",
      "- The report should separate recommendation from autonomous execution.",
      "- The system should explain which prior memories influenced the current analysis.",
      "- The 0G integration points should be visible in both UI and README.",
    ].join("\n");
  }

  if (input.agentName === "final_agent") {
    return JSON.stringify(
      {
        summary:
          "The project has meaningful potential as an autonomous Web3 AI system, but it requires strict safeguards around execution, custody, external data quality, and persistent memory integrity.",
        score: 68,
        recommendation: "INVESTIGATE_MORE",
        risks: [
          {
            title: "Autonomous execution risk",
            severity: "high",
            explanation:
              "The agent may make or recommend actions that affect user funds without enough deterministic safeguards.",
          },
          {
            title: "Custody and permission risk",
            severity: "critical",
            explanation:
              "Any delegated wallet or signing flow must separate LLM reasoning from transaction execution.",
          },
          {
            title: "External data reliability risk",
            severity: "medium",
            explanation:
              "Yield, liquidity, and market data may be stale, incomplete, or manipulated.",
          },
          {
            title: "Memory poisoning risk",
            severity: "medium",
            explanation:
              "Persistent memory can improve reasoning but may also carry forward incorrect or malicious context.",
          },
        ],
        opportunities: [
          "Persistent memory can reuse previous risk patterns across analyses.",
          "0G Compute can provide a shared inference layer for each agent step.",
          "0G Storage can persist reports, receipts, and memory indexes.",
          "OpenClaw-compatible metadata can make the pipeline easier to inspect.",
        ],
        architecture: [
          "Use a multi-agent pipeline with Planner, Researcher, Risk, Architect, Critic, and Final Decision agents.",
          "Persist decision reports and memory indexes through 0G Storage.",
          "Keep signing and execution behind deterministic policy gates.",
          "Expose the orchestration graph through openclaw.yaml.",
        ],
        nextSteps: [
          "Add stricter execution policy checks.",
          "Add semantic memory retrieval.",
          "Add source-grounded document analysis.",
          "Expose OpenClaw manifest through a read-only API endpoint.",
        ],
        evidence: [
          "Local deterministic final-agent fallback returned strict JSON.",
          "The report includes risk, architecture, memory, and 0G infrastructure considerations.",
        ],
      },
      null,
      2
    );
  }

  return [
    `Local fallback response for ${input.agentName}.`,
    "The agent completed its task using deterministic MVP logic.",
  ].join("\n");
}
