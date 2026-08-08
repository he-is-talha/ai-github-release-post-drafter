import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runReplay } from "../../src/cli/replay.js";
import { processReleaseJob } from "../../src/worker/processRelease.js";
import { loadTieringRules } from "../../src/tiering/load.js";
import { createFixtureGitHubClient } from "../../src/github/enrich.js";
import type { LlmProvider } from "../../src/llm/provider.js";

const publishedPath = join(
  process.cwd(),
  "fixtures/github/release.published.json",
);
const prereleasePath = join(
  process.cwd(),
  "fixtures/github/release.prerelease.json",
);

function fakeLlm(): LlmProvider {
  return {
    completeJson: async (prompt: string) => {
      const platform = prompt.includes('platform: "x"') ||
          prompt.includes("platform: x") ||
          /must be "x"/.test(prompt)
        ? "x"
        : "linkedin";
      return {
        hook:
          platform === "x"
            ? "Release wired to a draft."
            : "This post started as a GitHub release.",
        body:
          platform === "x"
            ? "HMAC, idempotency, human approval. No auto-post."
            : "We turn verified release webhooks into schema-locked drafts for LinkedIn and X, with a human approval step.",
        tags: ["releases", "webhooks"],
        tier: "post-worthy",
        ruleId: "post-worthy-published-notes",
        platform,
      };
    },
  };
}

describe("fixture replay", () => {
  it("marks published fixture as post-worthy and invokes draftAndWrite", async () => {
    const payload = JSON.parse(readFileSync(publishedPath, "utf-8"));
    const draftAndWrite = vi.fn(async () => ({ paths: ["/tmp/x.md"] }));
    const result = await processReleaseJob(
      {
        deliveryId: "fixture-published",
        eventName: "release",
        payload,
      },
      {
        rules: loadTieringRules(),
        github: createFixtureGitHubClient(payload),
        draftAndWrite,
      },
    );

    expect(result).toMatchObject({
      status: "drafted",
      tier: "post-worthy",
      ruleId: "post-worthy-published-notes",
      paths: ["/tmp/x.md"],
    });
    expect(draftAndWrite).toHaveBeenCalledTimes(1);
  });

  it("skips prerelease fixture without drafting", async () => {
    const payload = JSON.parse(readFileSync(prereleasePath, "utf-8"));
    const draftAndWrite = vi.fn(async () => undefined);
    const result = await processReleaseJob(
      {
        deliveryId: "fixture-prerelease",
        eventName: "release",
        payload,
      },
      {
        rules: loadTieringRules(),
        github: createFixtureGitHubClient(payload),
        draftAndWrite,
      },
    );

    expect(result).toMatchObject({
      status: "skipped",
      tier: "changelog-only",
    });
    expect(draftAndWrite).not.toHaveBeenCalled();
  });

  it("runReplay writes exactly one draft markdown file", async () => {
    const draftsDir = await mkdtemp(join(tmpdir(), "replay-drafts-"));
    const out = await runReplay(
      [
        "--fixture",
        "fixtures/github/release.published.json",
        "--delivery-id",
        `test-${Date.now()}`,
        "--drafts-dir",
        draftsDir,
      ],
      { llm: fakeLlm(), draftsDir },
    );

    expect(out.duplicate).toBe(false);
    if (out.duplicate) return;
    expect(out.result.status).toBe("drafted");
    expect(out.paths).toHaveLength(1);

    const files = await readdir(draftsDir);
    expect(files.filter((f) => f.endsWith(".md"))).toHaveLength(1);
    const content = await readFile(out.paths[0]!, "utf8");
    expect(content).toContain("tier: post-worthy");
    expect(content).toContain("ruleId: post-worthy-published-notes");
    expect(content).toContain("## LinkedIn");
    expect(content).toContain("## X");
  });
});
