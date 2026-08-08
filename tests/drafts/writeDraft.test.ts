import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Draft } from "../../src/schema/draft.js";
import { slugify } from "../../src/drafts/slug.js";
import { toFrontMatter } from "../../src/drafts/frontMatter.js";
import {
  buildDraftMarkdown,
  writeDraftFiles,
} from "../../src/drafts/writeDraft.js";
import { createDraftAndWrite } from "../../src/drafts/generateAndWrite.js";
import type { LlmProvider } from "../../src/llm/provider.js";

const linkedin: Draft = {
  hook: "Same release, delivered twice — one draft.",
  body: "We verify HMAC, claim the delivery id, then draft posts into a file for approval.",
  tags: ["webhooks", "idempotency"],
  tier: "post-worthy",
  ruleId: "published-with-notes",
  platform: "linkedin",
};

const x: Draft = {
  hook: "Release → draft, not auto-post.",
  body: "HMAC + idempotency + human approval PR. Boring on purpose.",
  tags: ["releases"],
  tier: "post-worthy",
  ruleId: "published-with-notes",
  platform: "x",
};

describe("slugify", () => {
  it("slugifies tag names", () => {
    expect(slugify("v1.2.0")).toBe("v1-2-0");
    expect(slugify("Release 1.0!")).toBe("release-1-0");
  });
});

describe("toFrontMatter", () => {
  it("includes tier and ruleId", () => {
    const fm = toFrontMatter({
      tier: "post-worthy",
      ruleId: "published-with-notes",
      deliveryId: "del-1",
      releaseId: 42,
      tag: "v1.2.0",
      platforms: ["linkedin", "x"],
      createdAt: "2026-08-08T00:00:00.000Z",
    });
    expect(fm).toContain("tier: post-worthy");
    expect(fm).toContain("ruleId: published-with-notes");
    expect(fm.startsWith("---")).toBe(true);
    expect(fm.endsWith("---")).toBe(true);
  });
});

describe("writeDraftFiles", () => {
  it("writes one markdown file with front-matter and both platform sections", async () => {
    const dir = await mkdtemp(join(tmpdir(), "drafts-"));
    const result = await writeDraftFiles(
      dir,
      {
        tier: "post-worthy",
        ruleId: "published-with-notes",
        deliveryId: "del-1",
        releaseId: 42,
        tag: "v1.2.0",
        createdAt: "2026-08-08T12:00:00.000Z",
      },
      { linkedin, x },
    );

    expect(result.paths).toHaveLength(1);
    expect(result.filename).toBe("2026-08-08-v1-2-0.md");

    const content = await readFile(result.paths[0]!, "utf8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("tier: post-worthy");
    expect(content).toContain("ruleId: published-with-notes");
    expect(content).toContain("## LinkedIn");
    expect(content).toContain("## X");
    expect(content).toContain(linkedin.hook);
    expect(content).toContain(x.body);
  });
});

describe("createDraftAndWrite", () => {
  it("generates both platforms via fake LLM and writes one file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "drafts-gen-"));
    const responses = [
      { ...linkedin },
      { ...x },
    ];
    let i = 0;
    const llm: LlmProvider = {
      completeJson: async () => {
        const next = responses[i] ?? responses[responses.length - 1]!;
        i += 1;
        return next;
      },
    };

    const draftAndWrite = createDraftAndWrite({ llm, draftsDir: dir });
    const written = await draftAndWrite({
      deliveryId: "del-9",
      eventName: "release",
      tier: "post-worthy",
      ruleId: "published-with-notes",
      enriched: {
        owner: "example",
        repo: "repo",
        releaseId: 9,
        releaseName: "v1.2.0",
        tagName: "v1.2.0",
        body: "notes",
        diffStats: null,
      },
      diffStats: null,
    });

    expect(written.paths).toHaveLength(1);
    const content = await readFile(written.paths[0]!, "utf8");
    expect(content).toContain("tier: post-worthy");
    expect(content).toContain("ruleId: published-with-notes");
    expect(buildDraftMarkdown).toBeTypeOf("function");
  });
});
