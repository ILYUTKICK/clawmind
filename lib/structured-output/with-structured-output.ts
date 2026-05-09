// ---------------------------------------------------------------------------
// ClawMind — Structured Output Validation with Retry Cascade
// ---------------------------------------------------------------------------
// Validates agent output against Zod schemas.
// Implements the 3-tier retry cascade:
//   1st attempt: parse raw output → validate against Zod schema
//   2nd attempt (retry 1): repair prompt with SAME model
//   3rd attempt (retry 2): repair prompt with SIMPLER model (deepseek)
//   Then: fail gracefully with partial report
//
// For each step we log:
//   - which model was used
//   - whether validation passed
//   - how many retries were needed
//   - the final validation status
// ---------------------------------------------------------------------------

import { z } from "zod";
import { AGENT_SCHEMAS, getSchemaDescription } from "./schemas";
import { runInference } from "@/lib/compute/zero-g-compute";

// ── Types ──────────────────────────────────────────────────────────────────

export type ValidationResult<T> = {
  /** Whether the output was successfully validated */
  success: boolean;
  /** The validated (and possibly repaired) structured output */
  data: T | null;
  /** The original raw output from the model */
  rawOutput: string;
  /** How many retries were needed (0 = first attempt passed) */
  retriesUsed: number;
  /** Which model was used for the final successful attempt */
  finalModel: string;
  /** The validation mode that produced the final output */
  mode:
    | "FIRST_ATTEMPT"
    | "REPAIR_RETRY_SAME_MODEL"
    | "REPAIR_RETRY_SIMPLER_MODEL"
    | "FALLBACK_PARTIAL";
  /** Zod validation errors, if any */
  validationErrors: string[];
  /** Logs of each attempt */
  attemptLog: ValidationAttempt[];
};

type ValidationAttempt = {
  attempt: number;
  model: string;
  mode: string;
  success: boolean;
  errors: string[];
  durationMs: number;
};

// ── Simpler model for 2nd retry ────────────────────────────────────────────

const SIMPLER_MODEL = "deepseek/deepseek-chat-v3-0324";

// ── JSON extraction ────────────────────────────────────────────────────────

/**
 * Extract a JSON object from raw model output.
 * Handles markdown fences, prose before/after JSON, and common formatting issues.
 */
function extractJsonFromOutput(rawOutput: string): unknown | null {
  const cleaned = rawOutput
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/```json/gi, "```")
    .replace(/,\s*([}\]])/g, "$1");

  // Try fenced code block first
  const fencedMatch = cleaned.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? cleaned;

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    // Try array
    const firstBracket = candidate.indexOf("[");
    const lastBracket = candidate.lastIndexOf("]");

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        const jsonCandidate = candidate
          .slice(firstBracket, lastBracket + 1)
          .replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(jsonCandidate);
      } catch {
        return null;
      }
    }

    return null;
  }

  try {
    const jsonCandidate = candidate
      .slice(firstBrace, lastBrace + 1)
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
}

// ── Zod validation ─────────────────────────────────────────────────────────

function validateWithZod<T>(
  data: unknown,
  schema: z.ZodType<T>
): { success: boolean; data: T | null; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { success: false, data: null, errors };
}

// ── Repair prompt ──────────────────────────────────────────────────────────

function buildRepairPrompt(
  agentId: string,
  rawOutput: string,
  validationErrors: string[],
  schemaDescription: string
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: [
      "You are a JSON repair agent for ClawMind.",
      "The previous model output was invalid JSON or did not match the required schema.",
      "",
      "You MUST return a single valid JSON object. No markdown. No backticks. No comments. No trailing commas.",
      "Do not add prose before or after the JSON.",
      "",
      `The JSON object must match this shape:`,
      schemaDescription,
      "",
      "Validation errors from the previous attempt:",
      ...validationErrors.map((e) => `- ${e}`),
    ].join("\n"),
    userPrompt: [
      `Agent: ${agentId}`,
      "",
      "The previous output could not be validated. Here was the raw output:",
      "",
      rawOutput.slice(0, 3000),
      "",
      "Return a valid JSON object based on the above content. Fix any JSON syntax errors and ensure the structure matches the required schema.",
    ].join("\n"),
  };
}

// ── Main: withStructuredOutput ─────────────────────────────────────────────

/**
 * Validate agent output against a Zod schema with retry cascade.
 *
 * @param agentId - The agent step ID (e.g., "planner", "researcher")
 * @param rawOutput - The raw text output from the model
 * @param model - The model that produced the output
 * @param temperature - Temperature used for the original call
 * @param maxTokens - Max tokens used for the original call
 * @returns ValidationResult with structured data and attempt log
 */
export async function withStructuredOutput<T>(
  agentId: string,
  rawOutput: string,
  model: string,
  temperature?: number,
  maxTokens?: number
): Promise<ValidationResult<T>> {
  const schema = AGENT_SCHEMAS[agentId] as z.ZodType<T> | undefined;

  if (!schema) {
    // No schema registered for this agent — skip validation
    return {
      success: true,
      data: null,
      rawOutput,
      retriesUsed: 0,
      finalModel: model,
      mode: "FIRST_ATTEMPT",
      validationErrors: [],
      attemptLog: [
        {
          attempt: 1,
          model,
          mode: "NO_SCHEMA",
          success: true,
          errors: [],
          durationMs: 0,
        },
      ],
    };
  }

  const schemaDescription = getSchemaDescription(agentId);
  const attemptLog: ValidationAttempt[] = [];

  // ── Attempt 1: Parse and validate raw output ──

  const start1 = Date.now();
  const parsed1 = extractJsonFromOutput(rawOutput);

  if (parsed1 !== null) {
    const validation1 = validateWithZod<T>(parsed1, schema);

    attemptLog.push({
      attempt: 1,
      model,
      mode: "FIRST_ATTEMPT",
      success: validation1.success,
      errors: validation1.errors,
      durationMs: Date.now() - start1,
    });

    if (validation1.success && validation1.data !== null) {
      console.log(
        `[StructuredOutput] ${agentId} → PASSED on 1st attempt (model: ${model})`
      );

      return {
        success: true,
        data: validation1.data,
        rawOutput,
        retriesUsed: 0,
        finalModel: model,
        mode: "FIRST_ATTEMPT",
        validationErrors: [],
        attemptLog,
      };
    }
  } else {
    attemptLog.push({
      attempt: 1,
      model,
      mode: "FIRST_ATTEMPT",
      success: false,
      errors: ["Could not extract JSON from output."],
      durationMs: Date.now() - start1,
    });
  }

  console.warn(
    `[StructuredOutput] ${agentId} → FAILED 1st attempt, starting retry cascade...`
  );

  // ── Attempt 2: Repair with SAME model ──

  const errors1 = attemptLog[0]?.errors ?? ["Unknown validation error"];
  const repair1 = buildRepairPrompt(agentId, rawOutput, errors1, schemaDescription);

  const start2 = Date.now();
  try {
    const repairOutput1 = await runInference({
      agentName: `${agentId}_repair`,
      systemPrompt: repair1.systemPrompt,
      userPrompt: repair1.userPrompt,
      model, // Same model
      temperature: 0.05, // Very low temp for repair
      maxTokens: maxTokens ?? 2000,
    });

    const parsed2 = extractJsonFromOutput(repairOutput1);

    if (parsed2 !== null) {
      const validation2 = validateWithZod<T>(parsed2, schema);

      attemptLog.push({
        attempt: 2,
        model,
        mode: "REPAIR_RETRY_SAME_MODEL",
        success: validation2.success,
        errors: validation2.errors,
        durationMs: Date.now() - start2,
      });

      if (validation2.success && validation2.data !== null) {
        console.log(
          `[StructuredOutput] ${agentId} → PASSED on 2nd attempt (repair, same model: ${model})`
        );

        return {
          success: true,
          data: validation2.data,
          rawOutput: repairOutput1,
          retriesUsed: 1,
          finalModel: model,
          mode: "REPAIR_RETRY_SAME_MODEL",
          validationErrors: [],
          attemptLog,
        };
      }
    } else {
      attemptLog.push({
        attempt: 2,
        model,
        mode: "REPAIR_RETRY_SAME_MODEL",
        success: false,
        errors: ["Could not extract JSON from repair output."],
        durationMs: Date.now() - start2,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    attemptLog.push({
      attempt: 2,
      model,
      mode: "REPAIR_RETRY_SAME_MODEL",
      success: false,
      errors: [`Repair inference failed: ${msg}`],
      durationMs: Date.now() - start2,
    });
  }

  console.warn(
    `[StructuredOutput] ${agentId} → FAILED 2nd attempt (same model), trying simpler model...`
  );

  // ── Attempt 3: Repair with SIMPLER model ──

  const errors2 = attemptLog[1]?.errors ?? attemptLog[0]?.errors ?? [];
  const repair2 = buildRepairPrompt(agentId, rawOutput, errors2, schemaDescription);

  const start3 = Date.now();
  try {
    const repairOutput2 = await runInference({
      agentName: `${agentId}_repair_simple`,
      systemPrompt: repair2.systemPrompt,
      userPrompt: repair2.userPrompt,
      model: SIMPLER_MODEL, // Simpler, more format-stable model
      temperature: 0.05,
      maxTokens: maxTokens ?? 2000,
    });

    const parsed3 = extractJsonFromOutput(repairOutput2);

    if (parsed3 !== null) {
      const validation3 = validateWithZod<T>(parsed3, schema);

      attemptLog.push({
        attempt: 3,
        model: SIMPLER_MODEL,
        mode: "REPAIR_RETRY_SIMPLER_MODEL",
        success: validation3.success,
        errors: validation3.errors,
        durationMs: Date.now() - start3,
      });

      if (validation3.success && validation3.data !== null) {
        console.log(
          `[StructuredOutput] ${agentId} → PASSED on 3rd attempt (simpler model: ${SIMPLER_MODEL})`
        );

        return {
          success: true,
          data: validation3.data,
          rawOutput: repairOutput2,
          retriesUsed: 2,
          finalModel: SIMPLER_MODEL,
          mode: "REPAIR_RETRY_SIMPLER_MODEL",
          validationErrors: [],
          attemptLog,
        };
      }
    } else {
      attemptLog.push({
        attempt: 3,
        model: SIMPLER_MODEL,
        mode: "REPAIR_RETRY_SIMPLER_MODEL",
        success: false,
        errors: ["Could not extract JSON from simpler model repair output."],
        durationMs: Date.now() - start3,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    attemptLog.push({
      attempt: 3,
      model: SIMPLER_MODEL,
      mode: "REPAIR_RETRY_SIMPLER_MODEL",
      success: false,
      errors: [`Simpler model repair inference failed: ${msg}`],
      durationMs: Date.now() - start3,
    });
  }

  // ── All retries exhausted — return partial/fallback ──

  console.warn(
    `[StructuredOutput] ${agentId} → ALL retries exhausted. Returning fallback.`
  );

  const allErrors = attemptLog.flatMap((a) => a.errors);

  return {
    success: false,
    data: null,
    rawOutput,
    retriesUsed: 2,
    finalModel: model,
    mode: "FALLBACK_PARTIAL",
    validationErrors: allErrors,
    attemptLog,
  };
}

/**
 * Get the structured output instructions to add to an agent's system prompt.
 * This tells the model to return JSON in a specific format.
 */
export function getStructuredOutputInstructions(agentId: string): string {
  const schemaDescription = getSchemaDescription(agentId);

  return [
    "",
    "CRITICAL OUTPUT FORMAT:",
    "You MUST return a single valid JSON object. No markdown. No backticks. No prose. No comments. No trailing commas.",
    "The JSON object must match this exact shape:",
    schemaDescription,
  ].join("\n");
}
