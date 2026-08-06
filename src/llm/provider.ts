import { draftJsonSchema } from "../schema/draft.js";
import type { LlmEnv } from "../config/env.js";

export type LlmProvider = {
  completeJson(prompt: string): Promise<unknown>;
};

/** Strip a single markdown fence wrapper if the model ignored "JSON only". */
export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function parseJsonContent(raw: string): unknown {
  const text = stripJsonFences(raw);
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new Error(
      `LLM returned non-JSON content: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function createLlmProvider(env: LlmEnv): LlmProvider {
  if (env.llmProvider !== "ollama") {
    throw new Error(
      `LLM_PROVIDER="${env.llmProvider}" is not implemented in Project 3 (only ollama).`,
    );
  }

  const format = draftJsonSchema() as Record<string, unknown>;

  return {
    async completeJson(prompt: string): Promise<unknown> {
      const response = await fetch(`${env.ollamaHost}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.ollamaModel,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          format,
          options: { temperature: 0 },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Ollama /api/chat failed (${response.status}): ${body.slice(0, 500)}`,
        );
      }

      const payload = (await response.json()) as {
        message?: { content?: string };
      };
      const content = payload.message?.content;
      if (typeof content !== "string") {
        throw new Error("Ollama response missing message.content");
      }
      return parseJsonContent(content);
    },
  };
}
