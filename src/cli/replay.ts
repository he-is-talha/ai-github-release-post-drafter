import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFixtureGitHubClient } from "../github/enrich.js";
import { createMemoryIdempotencyStore } from "../idempotency/memoryStore.js";
import { loadTieringRules } from "../tiering/load.js";
import {
  processReleaseJob,
  type DraftAndWriteInput,
} from "../worker/processRelease.js";

function parseArgs(argv: string[]): { fixture: string; deliveryId: string } {
  let fixture = "";
  let deliveryId = `replay-${Date.now()}`;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture") {
      fixture = argv[++i] ?? "";
    } else if (arg === "--delivery-id") {
      deliveryId = argv[++i] ?? deliveryId;
    }
  }

  if (!fixture) {
    throw new Error(
      "Usage: npm run replay -- --fixture <path> [--delivery-id <id>]",
    );
  }

  return { fixture: resolve(process.cwd(), fixture), deliveryId };
}

export async function runReplay(argv: string[] = process.argv.slice(2)) {
  const { fixture, deliveryId } = parseArgs(argv);
  const payload = JSON.parse(readFileSync(fixture, "utf-8")) as unknown;
  const rules = loadTieringRules();
  const store = createMemoryIdempotencyStore();
  const claim = await store.tryClaim(deliveryId);
  if (claim === "duplicate") {
    console.log(
      JSON.stringify({ ok: true, duplicate: true, deliveryId }),
    );
    return { duplicate: true as const };
  }

  const drafted: DraftAndWriteInput[] = [];
  const result = await processReleaseJob(
    {
      deliveryId,
      eventName: "release",
      payload,
    },
    {
      rules,
      github: createFixtureGitHubClient(payload),
      draftAndWrite: async (input) => {
        drafted.push(input);
        console.log(
          JSON.stringify({
            msg: "draft stub",
            tier: input.tier,
            ruleId: input.ruleId,
            tag: input.enriched.tagName,
            diffStats: input.diffStats,
          }),
        );
      },
      log: (fields) => {
        console.log(JSON.stringify({ msg: "process", ...fields }));
      },
    },
  );

  console.log(JSON.stringify({ ok: true, result, drafts: drafted.length }));
  return { duplicate: false as const, result, drafts: drafted };
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
