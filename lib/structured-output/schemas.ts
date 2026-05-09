// ---------------------------------------------------------------------------
// ClawMind — Zod Schemas for Structured Output Validation
// ---------------------------------------------------------------------------
// Every agent in the pipeline has a Zod schema that validates the raw model
// output. This ensures type-safe, predictable results even when the LLM
// returns partially malformed JSON.
//
// Usage:
//   import { plannerOutputSchema, finalReportSchema } from "./schemas";
//   const result = plannerOutputSchema.parse(parsedJson);
// ---------------------------------------------------------------------------

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const riskSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskSeverity = z.infer<typeof riskSeveritySchema>;

export const recommendationSchema = z.enum(["GO", "NO_GO", "INVESTIGATE_MORE"]);
export type Recommendation = z.infer<typeof recommendationSchema>;

// ---------------------------------------------------------------------------
// 1. Memory Retrieval — not an LLM agent, but we still validate its output
// ---------------------------------------------------------------------------

export const memoryRetrievalOutputSchema = z.object({
  memoryCount: z.number().int().min(0),
  topMemorySummaries: z.array(z.string()).max(5),
  retrievalMethod: z.string().default("cosine_similarity_top_k"),
  embeddingModel: z.string().default("all-MiniLM-L6-v2"),
  maxSimilarityScore: z.number().min(0).max(1).optional(),
});
export type MemoryRetrievalOutput = z.infer<typeof memoryRetrievalOutputSchema>;

// ---------------------------------------------------------------------------
// 2. Planner Agent — task decomposition
// ---------------------------------------------------------------------------

export const planStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  description: z.string().min(1),
  targetAgent: z.string().optional(),
  rationale: z.string().optional(),
});

export const plannerOutputSchema = z.object({
  planSummary: z.string().min(1),
  steps: z.array(planStepSchema).min(1).max(10),
  identifiedSubtopics: z.array(z.string()).default([]),
  complexityAssessment: z.enum(["low", "medium", "high"]).default("medium"),
  requiresDeepResearch: z.boolean().default(false),
});
export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Research Agent — fact and assumption extraction
// ---------------------------------------------------------------------------

export const researchFactSchema = z.object({
  claim: z.string().min(1),
  source: z.string().default("task_description"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const researchAssumptionSchema = z.object({
  assumption: z.string().min(1),
  riskIfWrong: z.string().optional(),
  canValidate: z.boolean().default(false),
});

export const researcherOutputSchema = z.object({
  keyFacts: z.array(researchFactSchema).min(1).max(12),
  assumptions: z.array(researchAssumptionSchema).max(8).default([]),
  missingInformation: z.array(z.string()).default([]),
  signals: z.array(z.string()).default([]),
  researchCoverage: z.enum(["comprehensive", "partial", "minimal"]).default("partial"),
});
export type ResearcherOutput = z.infer<typeof researcherOutputSchema>;

// ---------------------------------------------------------------------------
// 4. Risk Agent — risk identification and severity assessment
// ---------------------------------------------------------------------------

export const riskItemSchema = z.object({
  title: z.string().min(1),
  severity: riskSeveritySchema,
  explanation: z.string().min(1),
  category: z.enum([
    "security",
    "financial",
    "autonomy",
    "privacy",
    "governance",
    "data",
    "infrastructure",
    "tokenomics",
    "oracle",
    "smart_contract",
    "operational",
  ]).default("operational"),
  mitigation: z.string().optional(),
  isNovel: z.boolean().default(false),
});

export const riskAgentOutputSchema = z.object({
  risks: z.array(riskItemSchema).min(1).max(10),
  overallRiskLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  riskCategories: z.array(z.string()).default([]),
  hasCriticalRisk: z.boolean().default(false),
  redFlags: z.array(z.string()).default([]),
});
export type RiskAgentOutput = z.infer<typeof riskAgentOutputSchema>;

// ---------------------------------------------------------------------------
// 5. Architect Agent — architecture recommendations
// ---------------------------------------------------------------------------

export const architectureComponentSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  technology: z.string().optional(),
  zeroGIntegration: z.enum(["compute", "storage", "chain", "none", "multiple"]).default("none"),
});

export const architectOutputSchema = z.object({
  architectureSummary: z.string().min(1),
  components: z.array(architectureComponentSchema).min(1).max(8),
  dataFlow: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  zeroGUsage: z.array(
    z.enum(["0G_COMPUTE", "0G_STORAGE", "0G_CHAIN"])
  ).default([]),
  scalabilityNotes: z.string().optional(),
});
export type ArchitectOutput = z.infer<typeof architectOutputSchema>;

// ---------------------------------------------------------------------------
// 6. Critic Agent — adversarial review
// ---------------------------------------------------------------------------

export const critiquePointSchema = z.object({
  target: z.string().min(1),
  issue: z.string().min(1),
  severity: z.enum(["critical", "major", "minor", "nit"]).default("minor"),
  suggestion: z.string().optional(),
});

export const criticOutputSchema = z.object({
  overallAssessment: z.string().min(1),
  weakPoints: z.array(critiquePointSchema).min(1).max(10),
  missingSafeguards: z.array(z.string()).default([]),
  demoRisks: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  confidenceInAnalysis: z.enum(["high", "medium", "low"]).default("medium"),
});
export type CriticOutput = z.infer<typeof criticOutputSchema>;

// ---------------------------------------------------------------------------
// 7. Final Decision Agent — structured report (most important schema)
// ---------------------------------------------------------------------------

export const finalRiskItemSchema = z.object({
  title: z.string().min(1),
  severity: riskSeveritySchema,
  explanation: z.string().min(1),
});

export const finalReportSchema = z.object({
  summary: z.string().min(10),
  score: z.number().int().min(0).max(100),
  recommendation: recommendationSchema,
  risks: z.array(finalRiskItemSchema).min(1).max(6),
  opportunities: z.array(z.string()).min(1).max(8),
  architecture: z.array(z.string()).min(1).max(8),
  nextSteps: z.array(z.string()).min(1).max(8),
  evidence: z.array(z.string()).min(1).max(10),
});
export type FinalReport = z.infer<typeof finalReportSchema>;

// ---------------------------------------------------------------------------
// 8. Memory Writer — distilled memory record
// ---------------------------------------------------------------------------

export const memoryWriterOutputSchema = z.object({
  memorySummary: z.string().min(10),
  keyRisks: z.array(z.string()).max(5),
  keyOpportunities: z.array(z.string()).max(5),
  recommendation: recommendationSchema,
  score: z.number().int().min(0).max(100),
  tags: z.array(z.string()).default([]),
});
export type MemoryWriterOutput = z.infer<typeof memoryWriterOutputSchema>;

// ---------------------------------------------------------------------------
// Schema Registry — maps agent name to its Zod schema
// ---------------------------------------------------------------------------

export const agentSchemaRegistry: Record<string, z.ZodTypeAny> = {
  memory_retrieval: memoryRetrievalOutputSchema,
  planner: plannerOutputSchema,
  researcher: researcherOutputSchema,
  risk_agent: riskAgentOutputSchema,
  architect: architectOutputSchema,
  critic: criticOutputSchema,
  final_agent: finalReportSchema,
  memory_writer: memoryWriterOutputSchema,
};

/**
 * Get the Zod schema for a given agent name.
 * Returns undefined if no schema is registered.
 */
export function getSchemaForAgent(agentName: string): z.ZodTypeAny | undefined {
  return agentSchemaRegistry[agentName];
}
