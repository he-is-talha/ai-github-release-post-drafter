import { describe, expect, it } from "vitest";
import { draftJsonSchema, parseDraft } from "../../src/schema/draft.js";

const validDraft = {
  hook: "This post started as a GitHub release.",
  body: "We wired releases to drafts so posting stays a habit, with a human approval step.",
  tags: ["release", "build-in-public"],
  tier: "post-worthy",
  ruleId: "published-with-notes",
  platform: "linkedin",
} as const;

describe("DraftSchema", () => {
  it("parses a valid fixture", () => {
    const result = parseDraft(validDraft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hook).toBe(validDraft.hook);
    expect(result.data.body).toBe(validDraft.body);
    expect(result.data.tags).toEqual([...validDraft.tags]);
    expect(result.data.tier).toBe("post-worthy");
    expect(result.data.ruleId).toBe(validDraft.ruleId);
    expect(result.data.platform).toBe("linkedin");
  });

  it("rejects a missing hook", () => {
    const { hook: _hook, ...withoutHook } = validDraft;
    const result = parseDraft(withoutHook);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid tier like "spam"', () => {
    const result = parseDraft({ ...validDraft, tier: "spam" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty tags item", () => {
    const result = parseDraft({ ...validDraft, tags: [""] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 tags", () => {
    const result = parseDraft({
      ...validDraft,
      tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
    });
    expect(result.success).toBe(false);
  });

  it('draftJsonSchema() returns an object with type: "object"', () => {
    const schema = draftJsonSchema();
    expect(schema).toMatchObject({ type: "object" });
  });
});
