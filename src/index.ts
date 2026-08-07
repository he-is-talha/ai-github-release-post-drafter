import { pathToFileURL } from "node:url";
import { loadAppEnv } from "./config/env.js";
import { createFixtureGitHubClient } from "./github/enrich.js";
import { createGitHubClient } from "./github/octokitClient.js";
import { createIdempotencyBackend } from "./idempotency/create.js";
import { createMemoryQueue } from "./queue/memoryQueue.js";
import { buildApp } from "./server/app.js";
import { loadTieringRules } from "./tiering/load.js";
import { processReleaseJob } from "./worker/processRelease.js";

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
  const rules = loadTieringRules();

  const queue = createMemoryQueue(async (job) => {
    const github = env.githubToken
      ? createGitHubClient(env.githubToken)
      : createFixtureGitHubClient(job.payload);

    await processReleaseJob(job, {
      rules,
      github,
      draftAndWrite: async (input) => {
        console.log(
          JSON.stringify({
            msg: "draft stub (chunk 12 will write files)",
            deliveryId: input.deliveryId,
            tier: input.tier,
            ruleId: input.ruleId,
            tag: input.enriched.tagName,
          }),
        );
      },
      log: (fields) => console.log(JSON.stringify(fields)),
    });
  });

  const app = await buildApp({
    webhookSecret: env.githubWebhookSecret,
    idempotency,
    enqueue: (job) => queue.enqueue(job),
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
