type InferenceInput = {
  agentName: string;
  systemPrompt: string;
  userPrompt: string;
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

function getComputeConfig() {
  const endpoint = process.env.ZERO_G_COMPUTE_ENDPOINT;
  const apiKey = process.env.ZERO_G_COMPUTE_API_KEY;
  const model = process.env.ZERO_G_COMPUTE_MODEL || "llama-3.3-70b-instruct";

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

export async function runInference(input: InferenceInput): Promise<string> {
  const config = getComputeConfig();

  if (!config.isConfigured) {
    return runLocalFallbackInference(input);
  }

  try {
    const response = await fetch(config.endpoint as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
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
        temperature: input.agentName === "final_agent" ? 0.1 : 0.2,
        max_tokens: input.agentName === "final_agent" ? 2500 : 1200,
      }),
    });

    const data = (await response.json()) as OpenAICompatibleResponse;

    if (!response.ok) {
      console.warn(
        `[0G Compute] ${input.agentName} failed: ${
          data.error?.message || response.statusText
        }`
      );

      return runLocalFallbackInference(input);
    }

    const content = data.choices?.[0]?.message?.content;

    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim();
    }

    console.warn(`[0G Compute] ${input.agentName} returned empty content.`);

    return runLocalFallbackInference(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.warn(`[0G Compute] ${input.agentName} exception: ${message}`);

    return runLocalFallbackInference(input);
  }
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
    2,
  );
}

  return [
    `Local fallback response for ${input.agentName}.`,
    "The agent completed its task using deterministic MVP logic.",
  ].join("\n");
}