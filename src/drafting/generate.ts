import type { z } from "zod";
import { parseDraft, type Draft } from "../schema/draft.js";
import type { LlmProvider } from "../llm/provider.js";
import { buildDraftPrompt } from "./prompt.js";
import type { DraftPromptInput } from "./types.js";

export const MAX_REPAIR_ATTEMPTS = 2;
export const MAX_TOTAL_ATTEMPTS = 1 + MAX_REPAIR_ATTEMPTS;

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) {
    return error.message;
  }
  const field = first.path.length > 0 ? first.path.join(".") : undefined;
  return field ? `${field}: ${first.message}` : first.message;
}

export function buildRepairPrompt(
  basePrompt: string,
  previousJson: string,
  errorText: string,
): string {
  return [
    basePrompt,
    "",
    "## Repair",
    "Your previous JSON failed validation.",
    "Fix ONLY the reported errors and return corrected JSON that matches the schema.",
    "Return JSON only. No markdown fences.",
    "",
    "Validation errors:",
    errorText,
    "",
    "Previous JSON:",
    previousJson,
  ].join("\n");
}

export async function generateDraft(
  input: DraftPromptInput,
  llm: LlmProvider,
): Promise<Draft> {
  const basePrompt = buildDraftPrompt(input);
  let prompt = basePrompt;
  let lastError = "unknown error";
  let lastJson = "(empty)";

  for (let attempt = 0; attempt < MAX_TOTAL_ATTEMPTS; attempt++) {
    let raw: unknown;
    try {
      raw = await llm.completeJson(prompt);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastJson = "(provider error)";
      prompt = buildRepairPrompt(basePrompt, lastJson, lastError);
      continue;
    }

    lastJson =
      typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const parsed = parseDraft(raw);
    if (parsed.success) {
      return parsed.data;
    }

    lastError = formatZodError(parsed.error);
    prompt = buildRepairPrompt(basePrompt, lastJson, lastError);
  }

  throw new Error(
    `generateDraft failed after ${MAX_TOTAL_ATTEMPTS} attempts: ${lastError}`,
  );
}
