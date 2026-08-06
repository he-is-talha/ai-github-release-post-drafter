import { describe, expect, it, vi } from "vitest";
import {
  buildRepairPrompt,
  generateDraft,
  MAX_TOTAL_ATTEMPTS,
} from "../../src/drafting/generate.js";
import type { DraftPromptInput } from "../../src/drafting/types.js";
import type { LlmProvider } from "../../src/llm/provider.js";
import { createLlmProvider } from "../../src/llm/provider.js";
import { loadLlmEnv } from "../../src/config/env.js";

const input: DraftPromptInput = {
  releaseName: "v1.2.0 — Fixture Demo",
  tagName: "v1.2.0",
  body: "Adds webhook idempotency and HMAC verification.",
  diffStats: { commits: 3, additions: 120, deletions: 10, filesChanged: 4 },
  tier: "post-worthy",
  ruleId: "published-with-notes",
  platform: "linkedin",
};

const validDraft = {
  hook: "Same release, delivered twice — one draft.",
  body: "We verify HMAC, claim the delivery id, then draft LinkedIn and X posts into a PR for approval.",
  tags: ["webhooks", "idempotency"],
  tier: "post-worthy",
  ruleId: "published-with-notes",
  platform: "linkedin",
};

function fakeLlm(responses: unknown[]): LlmProvider {
  let i = 0;
  return {
    completeJson: vi.fn(async () => {
      const next = responses[i] ?? responses[responses.length - 1]!;
      i += 1;
      return next;
    }),
  };
}

describe("buildRepairPrompt", () => {
  it("injects validator error text and previous JSON", () => {
    const prompt = buildRepairPrompt(
      "base prompt",
      '{"hook":1}',
      "hook: Expected string",
    );
    expect(prompt).toContain("base prompt");
    expect(prompt).toContain("hook: Expected string");
    expect(prompt).toContain('{"hook":1}');
  });
});

describe("generateDraft repair loop", () => {
  it("returns a Draft on the first valid response", async () => {
    const llm = fakeLlm([validDraft]);
    const draft = await generateDraft(input, llm);
    expect(draft).toEqual(validDraft);
    expect(llm.completeJson).toHaveBeenCalledTimes(1);
  });

  it("repairs after a schema failure then succeeds", async () => {
    const bad = { ...validDraft, hook: 123 };
    const llm = fakeLlm([bad, validDraft]);
    const draft = await generateDraft(input, llm);
    expect(draft.hook).toBe(validDraft.hook);
    expect(draft.tier).toBe("post-worthy");
    expect(llm.completeJson).toHaveBeenCalledTimes(2);
  });

  it("stops after max attempts on persistent schema failure", async () => {
    const bad = { ...validDraft, hook: "" };
    const llm = fakeLlm([bad, bad, bad]);
    await expect(generateDraft(input, llm)).rejects.toThrow(
      /failed after 3 attempts/i,
    );
    expect(llm.completeJson).toHaveBeenCalledTimes(MAX_TOTAL_ATTEMPTS);
  });
});

describe("createLlmProvider", () => {
  it("throws for non-ollama providers", () => {
    expect(() =>
      createLlmProvider(loadLlmEnv({ LLM_PROVIDER: "openai" })),
    ).toThrow(/not implemented in Project 3/i);
  });

  it("defaults model to gemma3:4b", () => {
    const env = loadLlmEnv({});
    expect(env.ollamaModel).toBe("gemma3:4b");
    expect(env.llmProvider).toBe("ollama");
  });
});
