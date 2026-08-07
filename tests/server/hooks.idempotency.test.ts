import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { createMemoryIdempotencyStore } from "../../src/idempotency/memoryStore.js";
import { signGitHubBody } from "../../src/github/hmac.js";

const SECRET = "test-webhook-secret";
const BODY = Buffer.from(
  JSON.stringify({
    action: "published",
    release: { id: 99, tag_name: "v2.0.0", draft: false, prerelease: false },
  }),
  "utf8",
);
const DELIVERY_ID = "same-delivery-uuid";

describe("POST /hooks/github idempotency", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("returns 200 duplicate on replay and does not enqueue again", async () => {
    const store = createMemoryIdempotencyStore();
    const enqueue = vi.fn();
    app = await buildApp({
      webhookSecret: SECRET,
      idempotency: store,
      enqueue,
    });

    const signature = signGitHubBody(BODY, SECRET);
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
      payload: BODY,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ ok: true });
    expect(enqueue).toHaveBeenCalledTimes(1);

    const second = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers,
      payload: BODY,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ ok: true, duplicate: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
