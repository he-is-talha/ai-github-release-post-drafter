import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { createMemoryQueue } from "../../src/queue/memoryQueue.js";
import { signGitHubBody } from "../../src/github/hmac.js";

const SECRET = "test-webhook-secret";
const BODY = Buffer.from(
  JSON.stringify({
    action: "published",
    release: {
      id: 1,
      tag_name: "v1.0.0",
      body: "notes",
      draft: false,
      prerelease: false,
    },
  }),
  "utf8",
);

describe("POST /hooks/github async enqueue", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns 200 before a slow processor finishes", async () => {
    let finished = false;
    const started = Date.now();

    const queue = createMemoryQueue(async () => {
      await new Promise((r) => setTimeout(r, 80));
      finished = true;
    });

    app = await buildApp({
      webhookSecret: SECRET,
      enqueue: (job) => queue.enqueue(job),
    });

    const signature = signGitHubBody(BODY, SECRET);
    const res = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "release",
        "x-github-delivery": "async-1",
      },
      payload: BODY,
    });

    const elapsed = Date.now() - started;
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(finished).toBe(false);
    expect(elapsed).toBeLessThan(80);

    await new Promise((r) => setTimeout(r, 120));
    expect(finished).toBe(true);
  });

  it("enqueues the parsed payload", async () => {
    const enqueue = vi.fn();
    app = await buildApp({ webhookSecret: SECRET, enqueue });
    const signature = signGitHubBody(BODY, SECRET);

    await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "release",
        "x-github-delivery": "async-2",
      },
      payload: BODY,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({
      deliveryId: "async-2",
      eventName: "release",
      payload: expect.objectContaining({ action: "published" }),
    });
  });
});
