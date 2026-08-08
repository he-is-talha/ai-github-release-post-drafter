import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadAppEnv, loadLlmEnv } from "./config/env.js";
import { createDraftAndWrite } from "./drafts/generateAndWrite.js";
import {
  createDraftPrClient,
  parseGithubRepo,
} from "./github/draftPrClient.js";
import { createFixtureGitHubClient } from "./github/enrich.js";
import { createGitHubClient } from "./github/octokitClient.js";
import { openDraftPr } from "./github/openDraftPr.js";
import { createIdempotencyBackend } from "./idempotency/create.js";
import { createLlmProvider } from "./llm/provider.js";
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
  const llm = createLlmProvider(loadLlmEnv());
  const draftAndWrite = createDraftAndWrite({
    llm,
    draftsDir: join(process.cwd(), "drafts"),
  });

  const prClient =
    env.openPr && env.githubToken
      ? createDraftPrClient(env.githubToken)
      : null;

  const queue = createMemoryQueue(async (job) => {
    const github = env.githubToken
      ? createGitHubClient(env.githubToken)
      : createFixtureGitHubClient(job.payload);

    await processReleaseJob(job, {
      rules,
      github,
      draftAndWrite,
      openPr: async ({ input, write }) => {
        if (!prClient || !write.filename || !write.markdown) {
          return null;
        }
        const fromEnv = parseGithubRepo(env.githubRepo);
        const owner = fromEnv?.owner ?? input.enriched.owner;
        const repo = fromEnv?.repo ?? input.enriched.repo;
        if (!owner || !repo || owner === "local") {
          return null;
        }
        return openDraftPr(prClient, {
          owner,
          repo,
          tagName: input.enriched.tagName,
          deliveryId: input.deliveryId,
          filePath: `drafts/${write.filename}`,
          content: write.markdown,
        });
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
