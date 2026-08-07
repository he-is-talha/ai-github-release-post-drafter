import { pathToFileURL } from "node:url";
import { loadAppEnv } from "./config/env.js";
import { createIdempotencyBackend } from "./idempotency/create.js";
import { buildApp } from "./server/app.js";

export const APP_NAME = "ai-github-release-post-drafter";

export { buildApp } from "./server/app.js";

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  const env = loadAppEnv();
  const idempotency = createIdempotencyBackend({
    backend: env.idempotencyBackend,
    redisUrl: env.redisUrl,
  });
  const app = await buildApp({
    webhookSecret: env.githubWebhookSecret,
    idempotency,
    logger: true,
  });
  await app.listen({ port: env.port, host: env.host });
}

if (isMainModule()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
