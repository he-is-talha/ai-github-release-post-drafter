import { describe, expect, it, vi } from "vitest";
import {
  draftBranchName,
  openDraftPr,
  type DraftPrClient,
} from "../../src/github/openDraftPr.js";
import { loadAppEnv } from "../../src/config/env.js";
import { processReleaseJob } from "../../src/worker/processRelease.js";
import { loadTieringRules } from "../../src/tiering/load.js";

function mockPrClient(overrides?: Partial<DraftPrClient>): DraftPrClient {
  return {
    getDefaultBranch: vi.fn(async () => "main"),
    getRefSha: vi.fn(async () => "base-sha-abc"),
    createRef: vi.fn(async () => undefined),
    createOrUpdateFile: vi.fn(async () => undefined),
    createPullRequest: vi.fn(async () => ({
      number: 42,
      html_url: "https://github.com/acme/widgets/pull/42",
    })),
    ...overrides,
  };
}

describe("draftBranchName", () => {
  it("builds draft/release-{tagSlug}-{deliveryShort}", () => {
    expect(draftBranchName("v1.2.0", "abcdef12-uuid")).toBe(
      "draft/release-v1-2-0-abcdef12",
    );
  });
});

describe("openDraftPr", () => {
  it("creates a ref, commits the file, and opens a PR once", async () => {
    const client = mockPrClient();
    const result = await openDraftPr(client, {
      owner: "acme",
      repo: "widgets",
      tagName: "v1.2.0",
      deliveryId: "deliv123",
      filePath: "drafts/2026-08-08-v1-2-0.md",
      content: "---\ntier: post-worthy\n---\n",
    });

    expect(client.createRef).toHaveBeenCalledTimes(1);
    expect(client.createOrUpdateFile).toHaveBeenCalledTimes(1);
    expect(client.createPullRequest).toHaveBeenCalledTimes(1);
    expect(client.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "widgets",
        head: "draft/release-v1-2-0-deliv123",
        base: "main",
      }),
    );
    const prBody = (client.createPullRequest as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0]?.body as string;
    expect(prBody).toMatch(/Human approval required/i);
    expect(prBody).toMatch(/Do \*\*not\*\* auto-publish/i);

    expect(result).toEqual({
      prNumber: 42,
      url: "https://github.com/acme/widgets/pull/42",
      branch: "draft/release-v1-2-0-deliv123",
    });
  });

  it("continues when the branch already exists (422)", async () => {
    const client = mockPrClient({
      createRef: vi.fn(async () => {
        const err = new Error("Reference already exists") as Error & {
          status: number;
        };
        err.status = 422;
        throw err;
      }),
    });

    const result = await openDraftPr(client, {
      owner: "acme",
      repo: "widgets",
      tagName: "v1.2.0",
      deliveryId: "deliv123",
      filePath: "drafts/x.md",
      content: "body",
    });

    expect(client.createOrUpdateFile).toHaveBeenCalledTimes(1);
    expect(client.createPullRequest).toHaveBeenCalledTimes(1);
    expect(result.prNumber).toBe(42);
  });
});

describe("OPEN_PR env", () => {
  it("defaults openPr to false", () => {
    const env = loadAppEnv({
      GITHUB_WEBHOOK_SECRET: "secret",
    });
    expect(env.openPr).toBe(false);
  });

  it("parses OPEN_PR=true", () => {
    const env = loadAppEnv({
      GITHUB_WEBHOOK_SECRET: "secret",
      OPEN_PR: "true",
      GITHUB_REPO: "acme/widgets",
    });
    expect(env.openPr).toBe(true);
    expect(env.githubRepo).toBe("acme/widgets");
  });
});

describe("processReleaseJob openPr hook", () => {
  const payload = {
    action: "published",
    release: {
      id: 1,
      tag_name: "v1.2.0",
      name: "v1.2.0",
      body: "notes",
      draft: false,
      prerelease: false,
    },
    repository: {
      full_name: "acme/widgets",
      name: "widgets",
      owner: { login: "acme" },
    },
  };

  it("attaches PR result when openPr returns a PR", async () => {
    const result = await processReleaseJob(
      { deliveryId: "d1", eventName: "release", payload },
      {
        rules: loadTieringRules(),
        draftAndWrite: async () => ({
          paths: ["/tmp/draft.md"],
          filename: "2026-08-08-v1-2-0.md",
          markdown: "md",
        }),
        openPr: async () => ({
          prNumber: 7,
          url: "https://example/pr/7",
          branch: "draft/release-v1-2-0-d1",
        }),
      },
    );

    expect(result).toMatchObject({
      status: "drafted",
      pr: {
        prNumber: 7,
        url: "https://example/pr/7",
      },
    });
  });

  it("logs skip path when openPr returns null", async () => {
    const log = vi.fn();
    const result = await processReleaseJob(
      { deliveryId: "d2", eventName: "release", payload },
      {
        rules: loadTieringRules(),
        draftAndWrite: async () => ({ paths: ["/tmp/a.md"] }),
        openPr: async () => null,
        log,
      },
    );

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.pr).toBeUndefined();
    }
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "draft written locally; PR skipped",
      }),
    );
  });
});
