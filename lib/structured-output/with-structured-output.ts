// ---------------------------------------------------------------------------
// ClawMind — withStructuredOutput<T> — Zod Validation with Retry Logic
// ---------------------------------------------------------------------------
// Wraps any agent inference call with Zod schema validation.
// Retry strategy:
//   1. First attempt: parse raw LLM output → validate with Zod schema
//   2. Retry 1 (repair): re-prompt with the broken output + strict instructions
//   3. Retry 2 (simpler model): switch to deepseek/deepseek-chat-v3-0324
//   4. If all retries fail: return partial result with validationErrors field
//
// Usage:
//   import { withStructuredOutput } from "@/lib/structured-output/with-structured-output";
//   import { plannerOutputSchema, type PlannerOutput } from "@/lib/structured-output/schemas";
//
//   const result = await withStructuredOutput<PlannerOutput>({
//     agentName: "planner",
//     rawOutput: llmOutput,
//     schema: plannerOutputSchema,
//     runInferenceFn: (prompt) => runInference({ agentName: "planner", ...prompt }),
//     model: "deepseek/deepseek-chat-v3-0324",
//   });
// ---------------------------------------------------------------------------

import { z } from "zod";
import { getSchemaForAgent } from "./schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StructuredOutputResult<T> = {
  /** The validated, typed output */
  data: T;
  /** How many retries were needed (0 = first attempt succeeded) */
  retries: number;
  /** Which method produced the final result */
  method: "first_attempt" | "repair_retry" | "simpler_model_retry" | "partial_fallback";
  /** Any validation errors from failed attempts */
  validationErrors: string[];
  /** Whether the final result passed Zod validation */
  isValid: boolean;
};

export type RunInferenceFn = (input: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) => Promise<string>;

export type WithStructuredOutputInput<T> = {
  /** Agent name (used for logging and schema lookup) */
  agentName: string;
  /** Raw output from the LLM */
  rawOutput: string;
  /** Zod schema to validate against */
  schema: z.ZodTypeAny;
  /** Function to call for retry inference */
  runInferenceFn: RunInferenceFn;
  /** Current model being used */
  model?: string;
  /** Fallback model for retry 2 (defaults to deepseek) */
  fallbackModel?: string;
  /** Original system prompt (for repair retry) */
  originalSystemPrompt?: string;
  /** Original user prompt (for repair retry) */
  originalUserPrompt?: string;
  /** Maximum number of retries (default: 2) */
  maxRetries?: number;
};

// ---------------------------------------------------------------------------
// JSON Extraction — robust extraction from LLM output
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from raw LLM output.
 * Handles: markdown fences, prose before/after JSON, BOM, trailing commas.
 */
function extractJsonObject(raw: string): unknown | null {
  const cleaned = raw
    .trim()
    .replace(/^\uFEFF/, "")                    // BOM
    .replace(/```json/gi, "```")               // ```json → ```
    .replace(/,\s*([}\]])/g, "$1");            // trailing commas

  // Try fenced code block first
  const fencedMatch = cleaned.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? cleaned;

  const firstBrace = candidate.indexOf("{");
  const firstBracket = candidate.indexOf("[");

  // Determine if the top-level is an object or array
  let jsonStart = -1;
  let jsonEnd = -1;
  let startChar = "{";
  let endChar = "}";

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    jsonStart = firstBrace;
    startChar = "{";
    endChar = "}";
  } else if (firstBracket !== -1) {
    jsonStart = firstBracket;
    startChar = "[";
    endChar = "]";
  }

  if (jsonStart === -1) return null;

  // Find matching closing bracket/brace
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = jsonStart; i < candidate.length; i++) {
    const ch = candidate[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;

    if (depth === 0) {
      jsonEnd = i;
      break;
    }
  }

  if (jsonEnd === -1) return null;

  const jsonCandidate = candidate
    .slice(jsonStart, jsonEnd + 1)
    .replace(/,\s*([}\]])/g, "$1");

  try {
    const parsed = JSON.parse(jsonCandidate);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // JSON parse failed — fall through
  }

  return null;
}

// ---------------------------------------------------------------------------
// Schema Validation
// ---------------------------------------------------------------------------

/**
 * Validate parsed JSON against a Zod schema.
 * Returns the validated data or a list of error messages.
 */
function validateWithSchema<T>(
  data: unknown,
  schema: z.ZodTypeAny
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data as T };
  }

  const errors = result.error.errors.map((err) => {
    const path = err.path.join(".");
    return `${path || "root"}: ${err.message}`;
  });

  return { success: false, errors };
}

// ---------------------------------------------------------------------------
// Repair Prompt Builder
// ---------------------------------------------------------------------------

function buildRepairPrompt(
  agentName: string,
  rawOutput: string,
  validationErrors: string[]
): { systemPrompt: string; userPrompt: string } {
  // Build a schema description from the errors
  const errorList = validationErrors
    .map((err, i) => `${i + 1}. ${err}`)
    .join("\n");

  return {
    systemPrompt: [
      `You are a JSON repair agent for the ${agentName} in ClawMind.`,
      "The previous model output was invalid according to the expected schema.",
      "",
      "You MUST return a single valid JSON object that conforms to the schema.",
      "Rules:",
      "- No markdown formatting",
      "- No triple backticks",
      "- No comments",
      "- No trailing commas",
      "- Use double quotes for all keys and string values",
      "- The first character must be { and the last character must be }",
    ].join("\n"),
    userPrompt: [
      "The previous output had these validation errors:",
      "",
      errorList,
      "",
      "Here was the raw output:",
      "",
      rawOutput.slice(0, 3000),
      "",
      "Return a corrected valid JSON object that fixes all the errors above.",
      "Preserve as much of the original content as possible.",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Partial Fallback Builder
// ---------------------------------------------------------------------------

/**
 * Build a partial result from whatever we can extract.
 * Uses .partial() on the schema to make all fields optional,
 * then fills defaults where possible.
 */
function buildPartialResult<T>(
  rawOutput: string,
  schema: z.ZodTypeAny,
  errors: string[]
): StructuredOutputResult<T> {
  const extracted = extractJsonObject(rawOutput);

  if (extracted !== null) {
    // Try parsing with partial schema (all fields optional)
    try {
      const partialSchema = (schema as z.ZodObject<any>).partial();
      const partialResult = partialSchema.safeParse(extracted);

      if (partialResult.success) {
        return {
          data: partialResult.data as T,
          retries: 2,
          method: "partial_fallback",
          validationErrors: errors,
          isValid: false,
        };
      }
    } catch {
      // partial() not available on this schema type
    }

    // Return whatever we extracted even if unvalidated
    return {
      data: extracted as T,
      retries: 2,
      method: "partial_fallback",
      validationErrors: errors,
      isValid: false,
    };
  }

  // Absolute fallback — return empty object
  return {
    data: {} as T,
    retries: 2,
    method: "partial_fallback",
    validationErrors: [...errors, "Could not extract any JSON from raw output."],
    isValid: false,
  };
}

// ---------------------------------------------------------------------------
// Main: withStructuredOutput<T>
// ---------------------------------------------------------------------------

/**
 * Validate an agent's raw LLM output against its Zod schema,
 * with automatic retry logic for repair and model fallback.
 */
export async function withStructuredOutput<T>(
  input: WithStructuredOutputInput<T>
): Promise<StructuredOutputResult<T>> {
  const {
    agentName,
    rawOutput,
    schema,
    runInferenceFn,
    model,
    fallbackModel = "deepseek/deepseek-chat-v3-0324",
    originalSystemPrompt,
    originalUserPrompt,
    maxRetries = 2,
  } = input;

  const allValidationErrors: string[] = [];

  // ── Attempt 0: Direct validation of raw output ──
  const extracted = extractJsonObject(rawOutput);

  if (extracted !== null) {
    const validation = validateWithSchema<T>(extracted, schema);

    if (validation.success) {
      console.log(
        `[StructuredOutput] ${agentName} — passed on first attempt (${rawOutput.length} chars)`
      );
      return {
        data: validation.data,
        retries: 0,
        method: "first_attempt",
        validationErrors: [],
        isValid: true,
      };
    }

    allValidationErrors.push(...validation.errors);
    console.warn(
      `[StructuredOutput] ${agentName} — validation failed (${validation.errors.length} errors). Attempting repair...`
    );
  } else {
    allValidationErrors.push("Could not extract JSON from raw output.");
    console.warn(
      `[StructuredOutput] ${agentName} — JSON extraction failed. Attempting repair...`
    );
  }

  // ── Retry 1: Repair with same model ──
  if (maxRetries >= 1) {
    try {
      const repairPrompts = buildRepairPrompt(agentName, rawOutput, allValidationErrors);

      console.log(`[StructuredOutput] ${agentName} — repair retry with ${model ?? "default model"}`);

      const repairOutput = await runInferenceFn({
        systemPrompt: repairPrompts.systemPrompt,
        userPrompt: repairPrompts.userPrompt,
        model,
        temperature: 0.05, // Very low temperature for repair
        maxTokens: 3000,
      });

      const repairExtracted = extractJsonObject(repairOutput);

      if (repairExtracted !== null) {
        const repairValidation = validateWithSchema<T>(repairExtracted, schema);

        if (repairValidation.success) {
          console.log(`[StructuredOutput] ${agentName} — repair retry SUCCEEDED`);
          return {
            data: repairValidation.data,
            retries: 1,
            method: "repair_retry",
            validationErrors: allValidationErrors,
            isValid: true,
          };
        }

        allValidationErrors.push(
          ...repairValidation.errors.map((e) => `[repair] ${e}`)
        );
        console.warn(
          `[StructuredOutput] ${agentName} — repair retry still invalid (${repairValidation.errors.length} errors). Trying simpler model...`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      allValidationErrors.push(`[repair] exception: ${msg}`);
      console.warn(`[StructuredOutput] ${agentName} — repair retry exception: ${msg}`);
    }
  }

  // ── Retry 2: Simpler (fallback) model ──
  if (maxRetries >= 2 && model !== fallbackModel) {
    try {
      const repairPrompts = buildRepairPrompt(agentName, rawOutput, allValidationErrors);

      console.log(
        `[StructuredOutput] ${agentName} — simpler model retry with ${fallbackModel}`
      );

      const fallbackOutput = await runInferenceFn({
        systemPrompt: repairPrompts.systemPrompt,
        userPrompt: repairPrompts.userPrompt,
        model: fallbackModel,
        temperature: 0.05,
        maxTokens: 3000,
      });

      const fallbackExtracted = extractJsonObject(fallbackOutput);

      if (fallbackExtracted !== null) {
        const fallbackValidation = validateWithSchema<T>(fallbackExtracted, schema);

        if (fallbackValidation.success) {
          console.log(
            `[StructuredOutput] ${agentName} — simpler model retry SUCCEEDED with ${fallbackModel}`
          );
          return {
            data: fallbackValidation.data,
            retries: 2,
            method: "simpler_model_retry",
            validationErrors: allValidationErrors,
            isValid: true,
          };
        }

        allValidationErrors.push(
          ...fallbackValidation.errors.map((e) => `[fallback_model] ${e}`)
        );
        console.warn(
          `[StructuredOutput] ${agentName} — simpler model retry also invalid (${fallbackValidation.errors.length} errors). Returning partial.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      allValidationErrors.push(`[fallback_model] exception: ${msg}`);
      console.warn(
        `[StructuredOutput] ${agentName} — simpler model retry exception: ${msg}`
      );
    }
  }

  // ── Final fallback: partial result ──
  console.warn(
    `[StructuredOutput] ${agentName} — ALL retries exhausted. Returning partial result.`
  );

  return buildPartialResult<T>(rawOutput, schema, allValidationErrors);
}

// ---------------------------------------------------------------------------
// Convenience: validateAgentOutput
// ---------------------------------------------------------------------------

/**
 * Convenience function that combines runInference + withStructuredOutput.
 * This is the recommended way to call any agent in the pipeline.
 *
 * Usage:
 *   const result = await validateAgentOutput<PlannerOutput>({
 *     agentName: "planner",
 *     systemPrompt: "...",
 *     userPrompt: "...",
 *     runInferenceFn: (input) => runInference({ agentName: "planner", ...input }),
 *     model: "deepseek/deepseek-chat-v3-0324",
 *   });
 */
export async function validateAgentOutput<T>(
  input: {
    agentName: string;
    systemPrompt: string;
    userPrompt: string;
    runInferenceFn: RunInferenceFn;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    fallbackModel?: string;
    maxRetries?: number;
  }
): Promise<StructuredOutputResult<T>> {
  // Look up schema automatically
  const schema = getSchemaForAgent(input.agentName);

  if (!schema) {
    // No schema registered — skip validation, return raw
    const rawOutput = await input.runInferenceFn({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    return {
      data: extractJsonObject(rawOutput) as T ?? (rawOutput as unknown as T),
      retries: 0,
      method: "first_attempt",
      validationErrors: ["No Zod schema registered for this agent — validation skipped."],
      isValid: false,
    };
  }

  // Run the initial inference
  const rawOutput = await input.runInferenceFn({
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });

  // Validate with retries
  return withStructuredOutput<T>({
    agentName: input.agentName,
    rawOutput,
    schema,
    runInferenceFn: input.runInferenceFn,
    model: input.model,
    fallbackModel: input.fallbackModel,
    originalSystemPrompt: input.systemPrompt,
    originalUserPrompt: input.userPrompt,
    maxRetries: input.maxRetries,
  });
}
