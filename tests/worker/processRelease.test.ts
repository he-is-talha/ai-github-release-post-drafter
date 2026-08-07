import { describe, expect, it, vi } from "vitest";
import { loadTieringRules } from "../../src/tiering/load.js";
import { processReleaseJob } from "../../src/worker/processRelease.js";
import type { GitHubClient } from "../../src/github/types.js";

const rules = loadTieringRules();

const publishedPayload = {
  action: "published",
  release: {
    id: 1,
    tag_name: "v1.2.0",
    name: "v1.2.0",
    body: "Adds HMAC and idempotency.",
    draft: false,
    prerelease: false,
  },
  repository: {
    full_name: "example/repo",
    name: "repo",
    owner: { login: "example" },
  },
};

describe("processReleaseJob", () => {
  it("skips ignore / changelog tiers without calling draftAndWrite", async () => {
    const draftAndWrite = vi.fn();
    const prerelease = {
      action: "published",
      release: {
        id: 2,
        tag_name: "v1.2.0-rc.1",
        name: "rc",
        body: "rc notes",
        draft: false,
        prerelease: true,
      },
    };

    const result = await processReleaseJob(
      { deliveryId: "d1", eventName: "release", payload: prerelease },
      { rules, draftAndWrite },
    );

    expect(result).toMatchObject({
      status: "skipped",
      tier: "changelog-only",
      ruleId: "changelog-prerelease",
    });
    expect(draftAndWrite).not.toHaveBeenCalled();
  });

  it("calls draftAndWrite once for post-worthy releases", async () => {
    const draftAndWrite = vi.fn(async () => undefined);
    const result = await processReleaseJob(
      {
        deliveryId: "d2",
        eventName: "release",
        payload: publishedPayload,
      },
      { rules, draftAndWrite },
    );

    expect(result.status).toBe("drafted");
    expect(draftAndWrite).toHaveBeenCalledTimes(1);
    expect(draftAndWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: "d2",
        tier: "post-worthy",
        ruleId: "post-worthy-published-notes",
      }),
    );
  });

  it("passes enrich diffStats into draftAndWrite when github client is set", async () => {
    const draftAndWrite = vi.fn(async () => undefined);
    const github: GitHubClient = {
      getRelease: async () => ({
        id: 1,
        tagName: "v1.2.0",
        name: "v1.2.0",
        body: "from api",
        draft: false,
        prerelease: false,
      }),
      compareTags: async () => ({
        commits: 3,
        additions: 10,
        deletions: 2,
        filesChanged: 4,
      }),
    };

    await processReleaseJob(
      {
        deliveryId: "d3",
        eventName: "release",
        payload: publishedPayload,
      },
      { rules, draftAndWrite, github },
    );

    expect(draftAndWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        diffStats: {
          commits: 3,
          additions: 10,
          deletions: 2,
          filesChanged: 4,
        },
        enriched: expect.objectContaining({ body: "from api" }),
      }),
    );
  });
});
