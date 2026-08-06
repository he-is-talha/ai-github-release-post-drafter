import { describe, expect, it } from "vitest";
import { classifyEvent } from "../../src/tiering/classify.js";
import { loadTieringRules } from "../../src/tiering/load.js";
import type { ReleaseLike } from "../../src/tiering/types.js";

const rules = loadTieringRules();

function release(
  overrides: Partial<ReleaseLike["release"]> &
    Pick<ReleaseLike["release"], "tag_name">,
  action = "published",
): ReleaseLike {
  return {
    action,
    release: {
      id: 1,
      name: overrides.name ?? overrides.tag_name,
      body: overrides.body ?? "",
      draft: overrides.draft ?? false,
      prerelease: overrides.prerelease ?? false,
      ...overrides,
    },
  };
}

describe("loadTieringRules", () => {
  it("loads ordered rules from tiering.yaml", () => {
    expect(rules.length).toBeGreaterThanOrEqual(3);
    expect(rules.at(-1)?.id).toBe("default-ignore");
    expect(rules.at(-1)?.tier).toBe("ignore");
  });
});

describe("classifyEvent", () => {
  it.each([
    {
      name: "draft release → ignore",
      payload: release({
        tag_name: "v1.0.0",
        draft: true,
        body: "notes",
      }),
      tier: "ignore",
      ruleId: "ignore-draft-release",
    },
    {
      name: "chore tag → ignore",
      payload: release({
        tag_name: "chore-deps",
        body: "bump deps",
      }),
      tier: "ignore",
      ruleId: "ignore-chore-tag",
    },
    {
      name: "v0.0.0 placeholder → ignore",
      payload: release({
        tag_name: "v0.0.0",
        body: "placeholder",
      }),
      tier: "ignore",
      ruleId: "ignore-v0-placeholder",
    },
    {
      name: "prerelease → changelog-only",
      payload: release({
        tag_name: "v1.2.0-rc.1",
        prerelease: true,
        body: "RC notes",
      }),
      tier: "changelog-only",
      ruleId: "changelog-prerelease",
    },
    {
      name: "published with notes → post-worthy",
      payload: release({
        tag_name: "v1.2.0",
        body: "Adds HMAC and idempotency.",
      }),
      tier: "post-worthy",
      ruleId: "post-worthy-published-notes",
    },
    {
      name: "published empty body → default-ignore",
      payload: release({
        tag_name: "v1.2.0",
        body: "   ",
      }),
      tier: "ignore",
      ruleId: "default-ignore",
    },
  ] as const)("$name", ({ payload, tier, ruleId }) => {
    const result = classifyEvent(payload, rules);
    expect(result).toEqual({ tier, ruleId });
  });

  it("locks winning ruleId when draft and chore both could apply", () => {
    const result = classifyEvent(
      release({
        tag_name: "chore-x",
        draft: true,
        body: "x",
      }),
      rules,
    );
    // draft rule is earlier in YAML than chore
    expect(result.ruleId).toBe("ignore-draft-release");
  });
});
