import { AgentStep } from "@/lib/types";

type AgentPipelineProps = {
  steps: AgentStep[];
  isLoading: boolean;
};

function statusLabel(status: AgentStep["status"]): string {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Pending";
}

function statusClass(status: AgentStep["status"]): string {
  if (status === "completed") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "running") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }

  if (status === "failed") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }

  return "border-white/10 bg-white/[0.03] text-zinc-400";
}
function getPreviewLimit(stepName: AgentStep["name"]): number {
  if (stepName === "memory_retrieval") {
    return 520;
  }

  if (stepName === "memory_writer") {
    return 420;
  }

  return 300;
}

function hasLongOutput(
  output: string | undefined,
  stepName: AgentStep["name"]
): boolean {
  return Boolean(output && output.length > getPreviewLimit(stepName));
}
type FinalAgentPreview = {
  summary?: string;
  score?: number;
  recommendation?: string;
  risks?: Array<{
    title?: string;
    severity?: string;
    explanation?: string;
  }>;
};

function tryParseFinalAgentOutput(output: string): FinalAgentPreview | null {
  const trimmedOutput = output.trim();

  const firstBrace = trimmedOutput.indexOf("{");
  const lastBrace = trimmedOutput.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const jsonCandidate = trimmedOutput
      .slice(firstBrace, lastBrace + 1)
      .replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(jsonCandidate) as unknown;

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as FinalAgentPreview;
  } catch {
    return null;
  }
}

function getAgentOutputPreview(stepName: string, output: string): string {
  if (stepName !== "final_agent") {
    return output.length > 420 ? `${output.slice(0, 420)}...` : output;
  }

  const parsed = tryParseFinalAgentOutput(output);

  if (parsed === null) {
    return output.length > 420 ? `${output.slice(0, 420)}...` : output;
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : "Structured decision report generated.";

  const score = typeof parsed.score === "number" ? `${parsed.score}/100` : "Not provided";

  const recommendation =
    typeof parsed.recommendation === "string" && parsed.recommendation.trim().length > 0
      ? parsed.recommendation.trim()
      : "Not provided";

  const risks = Array.isArray(parsed.risks)
    ? parsed.risks
        .map((risk) => risk.title)
        .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
        .slice(0, 4)
        .join(", ")
    : "Not provided";

  return [
    "Structured final decision report generated.",
    "",
    `Summary: ${summary}`,
    `Score: ${score}`,
    `Recommendation: ${recommendation}`,
    `Key risks: ${risks || "Not provided"}`,
  ].join("\n");
}

export function AgentPipeline({ steps, isLoading }: AgentPipelineProps) {
  const visibleSteps =
    steps.length > 0
      ? steps
      : [
          {
            name: "memory_retrieval" as const,
            label: "Memory Retrieval",
            status: "pending" as const,
          },
          {
            name: "planner" as const,
            label: "Planner Agent",
            status: "pending" as const,
          },
          {
            name: "researcher" as const,
            label: "Research Agent",
            status: "pending" as const,
          },
          {
            name: "risk_agent" as const,
            label: "Risk Agent",
            status: "pending" as const,
          },
          {
            name: "architect" as const,
            label: "Architect Agent",
            status: "pending" as const,
          },
          {
            name: "critic" as const,
            label: "Critic Agent",
            status: "pending" as const,
          },
          {
            name: "final_agent" as const,
            label: "Final Decision Agent",
            status: "pending" as const,
          },
          {
            name: "memory_writer" as const,
            label: "Memory Writer",
            status: "pending" as const,
          },
        ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Agent Pipeline
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            OpenClaw-oriented orchestration view for the ClawMind cognitive
            backbone.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
            Running
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {visibleSteps.map((step, index) => (
          <div
            key={`${step.name}-${index}`}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {index + 1}. {step.label}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                  {getAgentOutputPreview(step.name, step.output ?? "")}
                </p>

                {hasLongOutput(step.output ?? "", step.name) ? (
                  <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 focus-within:border-cyan-400/30">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-cyan-200 outline-none">
                      View Raw Agent Output
                    </summary>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-400">
                      {step.output ?? ""}
                    </pre>
                  </details>
                ) : null}
              </div>

              <span
                className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                  step.status
                )}`}
              >
                {statusLabel(step.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}