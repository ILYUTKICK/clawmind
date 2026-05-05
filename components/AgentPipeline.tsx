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
                {step.output ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
                    {step.output}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">
                    Waiting for execution.
                  </p>
                )}
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