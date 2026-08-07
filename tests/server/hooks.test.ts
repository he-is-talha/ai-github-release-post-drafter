import { describe, expect, it, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { signGitHubBody } from "../../src/github/hmac.js";

const SECRET = "test-webhook-secret";
const BODY = Buffer.from(
  JSON.stringify({
    action: "published",
    release: { id: 1, tag_name: "v1.0.0", draft: false, prerelease: false },
  }),
  "utf8",
);

describe("POST /hooks/github", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("returns 200 for a valid HMAC signature", async () => {
    app = await buildApp({ webhookSecret: SECRET });
    const signature = signGitHubBody(BODY, SECRET);

    const res = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "release",
        "x-github-delivery": "delivery-1",
      },
      payload: BODY,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("returns 401 for a bad signature", async () => {
    app = await buildApp({ webhookSecret: SECRET });

    const res = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=" + "ab".repeat(32),
        "x-github-event": "release",
        "x-github-delivery": "delivery-2",
      },
      payload: BODY,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ ok: false, error: "invalid_signature" });
  });

  it("returns 401 when signature header is missing", async () => {
    app = await buildApp({ webhookSecret: SECRET });

    const res = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "release",
        "x-github-delivery": "delivery-3",
      },
      payload: BODY,
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when delivery id is missing", async () => {
    app = await buildApp({ webhookSecret: SECRET });
    const signature = signGitHubBody(BODY, SECRET);

    const res = await app.inject({
      method: "POST",
      url: "/hooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "release",
      },
      payload: BODY,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      ok: false,
      error: "missing_delivery_id",
    });
  });
});
