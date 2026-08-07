import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runReplay } from "../../src/cli/replay.js";
import { processReleaseJob } from "../../src/worker/processRelease.js";
import { loadTieringRules } from "../../src/tiering/load.js";
import { createFixtureGitHubClient } from "../../src/github/enrich.js";

const publishedPath = join(
  process.cwd(),
  "fixtures/github/release.published.json",
);
const prereleasePath = join(
  process.cwd(),
  "fixtures/github/release.prerelease.json",
);

describe("fixture replay", () => {
  it("marks published fixture as post-worthy and invokes draft stub", async () => {
    const payload = JSON.parse(readFileSync(publishedPath, "utf-8"));
    const draftAndWrite = vi.fn(async () => undefined);
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

  it("runReplay exits cleanly for the published fixture", async () => {
    const out = await runReplay([
      "--fixture",
      "fixtures/github/release.published.json",
      "--delivery-id",
      `test-${Date.now()}`,
    ]);
    expect(out.duplicate).toBe(false);
    if (out.duplicate) return;
    expect(out.result.status).toBe("drafted");
    expect(out.drafts).toHaveLength(1);
  });
});
