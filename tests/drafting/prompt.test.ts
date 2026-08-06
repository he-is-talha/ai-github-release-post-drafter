import { describe, expect, it } from "vitest";
import { buildDraftPrompt, loadStyleGuide } from "../../src/drafting/prompt.js";
import type { DraftPromptInput } from "../../src/drafting/types.js";

const input: DraftPromptInput = {
  releaseName: "v1.2.0 — Fixture Demo",
  tagName: "v1.2.0",
  body: "Adds webhook idempotency and HMAC verification.",
  diffStats: { commits: 3, additions: 120, deletions: 10, filesChanged: 4 },
  tier: "post-worthy",
  ruleId: "published-with-notes",
  platform: "linkedin",
};

describe("loadStyleGuide", () => {
  it("loads style-guide.md from the repo root", () => {
    const guide = loadStyleGuide();
    expect(guide).toContain("## Banned phrases");
    expect(guide).toContain("No emoji");
  });
});

describe("buildDraftPrompt", () => {
  it("includes style-guide snippet, release name, platform, and JSON-only instruction", () => {
    const prompt = buildDraftPrompt(input);

    expect(prompt).toContain("## Banned phrases");
    expect(prompt).toContain("game-changer");
    expect(prompt).toContain("v1.2.0 — Fixture Demo");
    expect(prompt).toContain("linkedin");
    expect(prompt).toMatch(/JSON only/i);
    expect(prompt).toContain('"hook"');
    expect(prompt).toContain('"body"');
    expect(prompt).toContain('"tags"');
    expect(prompt).toContain('"tier"');
    expect(prompt).toContain('"ruleId"');
    expect(prompt).toContain('"platform"');
  });

  it("does not mention the model name gemma3:4b", () => {
    const prompt = buildDraftPrompt(input);
    expect(prompt).not.toContain("gemma3:4b");
  });

  it("includes tier, ruleId, and diff stats", () => {
    const prompt = buildDraftPrompt(input);
    expect(prompt).toContain("tier: post-worthy");
    expect(prompt).toContain("ruleId: published-with-notes");
    expect(prompt).toContain("commits=3");
    expect(prompt).toContain("additions=120");
  });
});
