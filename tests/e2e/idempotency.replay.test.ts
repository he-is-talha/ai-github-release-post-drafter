import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { createMemoryIdempotencyStore } from "../../src/idempotency/memoryStore.js";
import { createMemoryQueue } from "../../src/queue/memoryQueue.js";
import { createDraftAndWrite } from "../../src/drafts/generateAndWrite.js";
import { createFixtureGitHubClient } from "../../src/github/enrich.js";
import { signGitHubBody } from "../../src/github/hmac.js";
import type { LlmProvider } from "../../src/llm/provider.js";
import {
  createCounters,
  snapshotCounters,
} from "../../src/metrics/counters.js";
import { loadTieringRules } from "../../src/tiering/load.js";
import { processReleaseJob } from "../../src/worker/processRelease.js";

const SECRET = "e2e-webhook-secret";
const DELIVERY_ID = "e2e-same-delivery";

function fakeLlm(): LlmProvider {
  return {
    completeJson: async (prompt: string) => {
      const platform = /must be "x"/.test(prompt) ? "x" : "linkedin";
      return {
        hook:
          platform === "x"
            ? "Release to draft."
            : "This post started as a GitHub release.",
        body:
          platform === "x"
            ? "HMAC + idempotency. Human approval only."
            : "Verified release webhooks become schema-locked drafts for approval.",
        tags: ["releases"],
        tier: "post-worthy",
        ruleId: "post-worthy-published-notes",
        platform,
      };
    },
  };
}

function loadFixture(name: string): Buffer {
  const text = readFileSync(
    join(process.cwd(), "fixtures/github", name),
    "utf8",
  );
  return Buffer.from(text, "utf8");
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  ms = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timed out waiting for condition");
}

describe("e2e idempotency replay", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("same delivery twice → one draft file and one duplicate drop", async () => {
    const draftsDir = await mkdtemp(join(tmpdir(), "e2e-drafts-"));
    const counters = createCounters();
    const store = createMemoryIdempotencyStore();
    const rules = loadTieringRules();
    const draftAndWrite = createDraftAndWrite({
      llm: fakeLlm(),
      draftsDir,
    });

    const queue = createMemoryQueue(async (job) => {
      await processReleaseJob(job, {
        rules,
        github: createFixtureGitHubClient(job.payload),
        draftAndWrite,
        counters,
      });
    });

    app = await buildApp({
      webhookSecret: SECRET,
      idempotency: store,
      enqueue: (job) => queue.enqueue(job),
      counters,
    });

    const body = loadFixture("release.published.json");
    const signature = signGitHubBody(body, SECRET);
    const headers = {
      "content-type": "application/json",
      "x-hub-signature-256": signature,
      "x-github-event": "release",
      "x-github-delivery": DELIVERY_ID,
    };

    const first = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers,
      payload: body,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ ok: true });

    await waitFor(async () => {
      const files = await readdir(draftsDir);
      return files.filter((f) => f.endsWith(".md")).length === 1;
    });

    const second = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers,
      payload: body,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ ok: true, duplicate: true });

    // Give the queue a beat — duplicate must not enqueue work
    await new Promise((r) => setTimeout(r, 100));
    const mdFiles = (await readdir(draftsDir)).filter((f) =>
      f.endsWith(".md"),
    );
    expect(mdFiles).toHaveLength(1);

    const content = await readFile(join(draftsDir, mdFiles[0]!), "utf8");
    expect(content).toContain("tier: post-worthy");
    expect(content).toContain("ruleId: post-worthy-published-notes");

    const snap = snapshotCounters(counters);
    expect(snap.duplicateDrops).toBe(1);
    expect(snap.draftSuccess).toBe(1);
    expect(snap.tierCounts["post-worthy"]).toBe(1);
  });

  it("changelog-only fixture writes zero draft files", async () => {
    const draftsDir = await mkdtemp(join(tmpdir(), "e2e-prerelease-"));
    const counters = createCounters();
    const rules = loadTieringRules();
    const payload = JSON.parse(
      readFileSync(
        join(process.cwd(), "fixtures/github/release.prerelease.json"),
        "utf8",
      ),
    );

    const result = await processReleaseJob(
      {
        deliveryId: "prerelease-1",
        eventName: "release",
        payload,
      },
      {
        rules,
        github: createFixtureGitHubClient(payload),
        draftAndWrite: createDraftAndWrite({
          llm: fakeLlm(),
          draftsDir,
        }),
        counters,
      },
    );

    expect(result).toMatchObject({
      status: "skipped",
      tier: "changelog-only",
    });
    const mdFiles = (await readdir(draftsDir)).filter((f) =>
      f.endsWith(".md"),
    );
    expect(mdFiles).toHaveLength(0);
    expect(snapshotCounters(counters).tierCounts["changelog-only"]).toBe(1);
    expect(snapshotCounters(counters).draftSuccess).toBe(0);
  });
});
