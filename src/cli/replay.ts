import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadLlmEnv } from "../config/env.js";
import { createDraftAndWrite } from "../drafts/generateAndWrite.js";
import { createFixtureGitHubClient } from "../github/enrich.js";
import { createMemoryIdempotencyStore } from "../idempotency/memoryStore.js";
import { createLlmProvider } from "../llm/provider.js";
import type { LlmProvider } from "../llm/provider.js";
import { loadTieringRules } from "../tiering/load.js";
import { processReleaseJob } from "../worker/processRelease.js";

function parseArgs(argv: string[]): {
  fixture: string;
  deliveryId: string;
  draftsDir: string;
} {
  let fixture = "";
  let deliveryId = `replay-${Date.now()}`;
  let draftsDir = join(process.cwd(), "drafts");

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture") {
      fixture = argv[++i] ?? "";
    } else if (arg === "--delivery-id") {
      deliveryId = argv[++i] ?? deliveryId;
    } else if (arg === "--drafts-dir") {
      draftsDir = resolve(process.cwd(), argv[++i] ?? draftsDir);
    }
  }

  if (!fixture) {
    throw new Error(
      "Usage: npm run replay -- --fixture <path> [--delivery-id <id>] [--drafts-dir <dir>]",
    );
  }

  return {
    fixture: resolve(process.cwd(), fixture),
    deliveryId,
    draftsDir,
  };
}

export type RunReplayOptions = {
  llm?: LlmProvider;
  draftsDir?: string;
};

export async function runReplay(
  argv: string[] = process.argv.slice(2),
  options: RunReplayOptions = {},
) {
  const parsed = parseArgs(argv);
  const draftsDir = options.draftsDir ?? parsed.draftsDir;
  const payload = JSON.parse(readFileSync(parsed.fixture, "utf-8")) as unknown;
  const rules = loadTieringRules();
  const store = createMemoryIdempotencyStore();
  const claim = await store.tryClaim(parsed.deliveryId);
  if (claim === "duplicate") {
    console.log(
      JSON.stringify({
        ok: true,
        duplicate: true,
        deliveryId: parsed.deliveryId,
      }),
    );
    return { duplicate: true as const };
  }

  const llm = options.llm ?? createLlmProvider(loadLlmEnv());
  const draftAndWrite = createDraftAndWrite({ llm, draftsDir });

  const result = await processReleaseJob(
    {
      deliveryId: parsed.deliveryId,
      eventName: "release",
      payload,
    },
    {
      rules,
      github: createFixtureGitHubClient(payload),
      draftAndWrite,
      log: (fields) => {
        console.log(JSON.stringify({ msg: "process", ...fields }));
      },
    },
  );

  console.log(
    JSON.stringify({
      ok: true,
      result,
      paths: result.status === "drafted" ? result.paths : [],
    }),
  );
  return {
    duplicate: false as const,
    result,
    paths: result.status === "drafted" ? (result.paths ?? []) : [],
  };
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("replay.ts") ||
    process.argv[1].endsWith("replay.js"));

if (isMain) {
  runReplay().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
