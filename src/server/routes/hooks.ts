import type { FastifyPluginAsync } from "fastify";
import { verifyGitHubSignature } from "../../github/hmac.js";
import type { IdempotencyStore } from "../../idempotency/types.js";

export type AcceptedDelivery = {
  deliveryId: string;
  eventName: string | undefined;
};

export type HooksRouteOpts = {
  webhookSecret: string;
  idempotency: IdempotencyStore;
  /** Called only after a successful claim (not on duplicates). */
  onAccepted?: (info: AcceptedDelivery) => void | Promise<void>;
};

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

function headerValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
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

    const signatureHeader = headerValue(
      request.headers["x-hub-signature-256"],
    );
    if (
      !verifyGitHubSignature(rawBody, signatureHeader, opts.webhookSecret)
    ) {
      return reply.code(401).send({ ok: false, error: "invalid_signature" });
    }

    const deliveryId = headerValue(request.headers["x-github-delivery"]);
    if (!deliveryId) {
      return reply.code(400).send({ ok: false, error: "missing_delivery_id" });
    }

    const eventName = headerValue(request.headers["x-github-event"]);
    const claim = await opts.idempotency.tryClaim(deliveryId);

    if (claim === "duplicate") {
      request.log.info(
        { deliveryId, event: eventName },
        "github webhook duplicate delivery",
      );
      return reply.code(200).send({ ok: true, duplicate: true });
    }

    request.log.info(
      { deliveryId, event: eventName },
      "github webhook accepted",
    );

    if (opts.onAccepted) {
      await opts.onAccepted({ deliveryId, eventName });
    }

    return reply.code(200).send({ ok: true });
  });
};
