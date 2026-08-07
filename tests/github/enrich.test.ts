import { describe, expect, it, vi } from "vitest";
import { enrichRelease } from "../../src/github/enrich.js";
import type { GitHubClient } from "../../src/github/types.js";

const payload = {
  action: "published",
  release: {
    id: 99,
    tag_name: "v2.0.0",
    name: "v2.0.0",
    body: "payload body",
    draft: false,
    prerelease: false,
  },
  repository: {
    full_name: "acme/widgets",
    name: "widgets",
    owner: { login: "acme" },
  },
};

describe("enrichRelease", () => {
  it("passes mock compare stats through", async () => {
    const client: GitHubClient = {
      getRelease: vi.fn(async () => ({
        id: 99,
        tagName: "v2.0.0",
        name: "v2.0.0 — Ship",
        body: "api body",
        draft: false,
        prerelease: false,
      })),
      compareTags: vi.fn(async () => ({
        commits: 5,
        additions: 100,
        deletions: 20,
        filesChanged: 7,
      })),
    };

    const enriched = await enrichRelease(payload, client);
    expect(enriched).toMatchObject({
      owner: "acme",
      repo: "widgets",
      releaseName: "v2.0.0 — Ship",
      body: "api body",
      diffStats: {
        commits: 5,
        additions: 100,
        deletions: 20,
        filesChanged: 7,
      },
    });
    expect(client.compareTags).toHaveBeenCalled();
  });

  it("sets diffStats null when compare fails", async () => {
    const client: GitHubClient = {
      getRelease: async () => ({
        id: 99,
        tagName: "v2.0.0",
        name: "v2.0.0",
        body: "ok",
        draft: false,
        prerelease: false,
      }),
      compareTags: async () => {
        throw new Error("404 Not Found");
      },
    };

    const enriched = await enrichRelease(payload, client);
    expect(enriched.diffStats).toBeNull();
    expect(enriched.body).toBe("ok");
  });
});
