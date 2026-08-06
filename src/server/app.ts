import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { hooksRoutes } from "./routes/hooks.js";

export type BuildAppOptions = {
  webhookSecret: string;
  logger?: FastifyServerOptions["logger"];
};

/**
 * Build the HTTP app. JSON bodies are parsed from a Buffer so HMAC can
 * verify the exact raw bytes GitHub signed.
 */
export async function buildApp(
  opts: BuildAppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      const buffer = Buffer.isBuffer(body)
        ? body
        : Buffer.from(body as string, "utf8");
      request.rawBody = buffer;
      try {
        const json: unknown =
          buffer.length === 0 ? {} : JSON.parse(buffer.toString("utf8"));
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(hooksRoutes, { webhookSecret: opts.webhookSecret });
  return app;
}
