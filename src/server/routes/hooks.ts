import type { FastifyPluginAsync } from "fastify";
import { verifyGitHubSignature } from "../../github/hmac.js";

export type HooksRouteOpts = {
  webhookSecret: string;
};

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export const hooksRoutes: FastifyPluginAsync<HooksRouteOpts> = async (
  app,
  opts,
) => {
  app.post("/hooks/github", async (request, reply) => {
    const rawBody = request.rawBody;
    if (!rawBody) {
      return reply.code(400).send({ ok: false, error: "missing_raw_body" });
    }

    const signature = request.headers["x-hub-signature-256"];
    const signatureHeader = Array.isArray(signature) ? signature[0] : signature;

    if (!verifyGitHubSignature(rawBody, signatureHeader, opts.webhookSecret)) {
      return reply.code(401).send({ ok: false, error: "invalid_signature" });
    }

    const event = request.headers["x-github-event"];
    const eventName = Array.isArray(event) ? event[0] : event;
    request.log.info({ event: eventName }, "github webhook accepted");

    return reply.code(200).send({ ok: true });
  });
};
