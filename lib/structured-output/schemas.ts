// ---------------------------------------------------------------------------
// ClawMind — Zod Schemas for Structured Output Validation
// ---------------------------------------------------------------------------
// Each agent's output is validated against a Zod schema.
// If validation fails, the retry cascade kicks in:
//   1st retry: repair prompt (same model)
//   2nd retry: simpler model (deepseek for format stability)
//   Then: fail with partial report
// ---------------------------------------------------------------------------

import { z } from "zod";

// ── Planner Agent ──────────────────────────────────────────────────────────

export const PlannerOutputSchema = z.object({
  steps: z.array(z.string().min(1)).min(1).max(8),
  reasoning: z.string().min(10),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

// ── Researcher Agent ───────────────────────────────────────────────────────

export const ResearcherOutputSchema = z.object({
  facts: z.array(z.string().min(1)).min(1).max(8),
  assumptions: z.array(z.string().min(1)).max(6).default([]),
  missingContext: z.array(z.string().min(1)).max(6).default([]),
});

export type ResearcherOutput = z.infer<typeof ResearcherOutputSchema>;

// ── Risk Agent ─────────────────────────────────────────────────────────────

export const RiskOutputSchema = z.object({
  risks: z
    .array(
      z.object({
        title: z.string().min(1),
        severity: z.enum(["low", "medium", "high", "critical"]),
        explanation: z.string().min(5),
      })
    )
    .min(1)
    .max(8),
});

export type RiskOutput = z.infer<typeof RiskOutputSchema>;

// ── Architect Agent ────────────────────────────────────────────────────────

export const ArchitectOutputSchema = z.object({
  recommendations: z.array(z.string().min(1)).min(1).max(8),
  components: z.array(z.string().min(1)).max(6).default([]),
});

export type ArchitectOutput = z.infer<typeof ArchitectOutputSchema>;

// ── Critic Agent ───────────────────────────────────────────────────────────

export const CriticOutputSchema = z.object({
  critiques: z.array(z.string().min(1)).min(1).max(8),
  missingSafeguards: z.array(z.string().min(1)).max(6).default([]),
  improvements: z.array(z.string().min(1)).max(6).default([]),
});

export type CriticOutput = z.infer<typeof CriticOutputSchema>;

// ── Final Agent ────────────────────────────────────────────────────────────

export const FinalOutputSchema = z.object({
  summary: z.string().min(10),
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(["GO", "NO_GO", "INVESTIGATE_MORE"]),
  risks: z
    .array(
      z.object({
        title: z.string().min(1),
        severity: z.enum(["low", "medium", "high", "critical"]),
        explanation: z.string().min(5),
      })
    )
    .min(1)
    .max(8),
  opportunities: z.array(z.string().min(1)).min(1).max(8),
  architecture: z.array(z.string().min(1)).min(1).max(8),
  nextSteps: z.array(z.string().min(1)).min(1).max(8),
  evidence: z.array(z.string().min(1)).max(10).default([]),
});

export type FinalOutput = z.infer<typeof FinalOutputSchema>;

// ── Schema Registry ────────────────────────────────────────────────────────

/**
 * Maps agent step IDs to their Zod schemas.
 * Used by withStructuredOutput to know which schema to validate against.
 */
export const AGENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  planner: PlannerOutputSchema,
  researcher: ResearcherOutputSchema,
  risk_agent: RiskOutputSchema,
  architect: ArchitectOutputSchema,
  critic: CriticOutputSchema,
  final_agent: FinalOutputSchema,
};

/**
 * Returns a JSON schema description for a given agent.
 * Used to generate repair prompts that tell the model what structure to return.
 */
export function getSchemaDescription(agentId: string): string {
  switch (agentId) {
    case "planner":
      return JSON.stringify(
        { steps: ["step 1", "step 2"], reasoning: "why these steps" },
        null,
        2
      );
    case "researcher":
      return JSON.stringify(
        {
          facts: ["fact 1", "fact 2"],
          assumptions: ["assumption 1"],
          missingContext: ["missing info 1"],
        },
        null,
        2
      );
    case "risk_agent":
      return JSON.stringify(
        {
          risks: [
            {
              title: "Risk title",
              severity: "low|medium|high|critical",
              explanation: "Why this is a risk",
            },
          ],
        },
        null,
        2
      );
    case "architect":
      return JSON.stringify(
        {
          recommendations: ["rec 1", "rec 2"],
          components: ["component 1"],
        },
        null,
        2
      );
    case "critic":
      return JSON.stringify(
        {
          critiques: ["critique 1"],
          missingSafeguards: ["safeguard 1"],
          improvements: ["improvement 1"],
        },
        null,
        2
      );
    case "final_agent":
      return JSON.stringify(
        {
          summary: "string",
          score: 0,
          recommendation: "GO|NO_GO|INVESTIGATE_MORE",
          risks: [{ title: "string", severity: "low", explanation: "string" }],
          opportunities: ["string"],
          architecture: ["string"],
          nextSteps: ["string"],
          evidence: ["string"],
        },
        null,
        2
      );
    default:
      return "No schema available.";
  }
}
