import type { DiffStats } from "../drafting/types.js";
import { enrichRelease } from "../github/enrich.js";
import { getReleaseFromPayload } from "../github/extractRelease.js";
import type { EnrichedRelease, GitHubClient } from "../github/types.js";
import type { WebhookJob } from "../queue/types.js";
import { classifyEvent } from "../tiering/classify.js";
import type { TieringRule } from "../tiering/types.js";

export type DraftAndWriteInput = {
  deliveryId: string;
  eventName: string | undefined;
  tier: "post-worthy";
  ruleId: string;
  enriched: EnrichedRelease;
  diffStats: DiffStats;
};

export type ProcessDeps = {
  rules: TieringRule[];
  draftAndWrite: (input: DraftAndWriteInput) => Promise<void>;
  github?: GitHubClient;
  log?: (fields: Record<string, unknown>) => void;
};

export type ProcessResult =
  | {
      status: "skipped";
      tier: "changelog-only" | "ignore";
      ruleId: string;
    }
  | {
      status: "drafted";
      tier: "post-worthy";
      ruleId: string;
      enriched: EnrichedRelease;
    }
  | { status: "ignored_event"; reason: string }
  | { status: "error"; message: string };

export async function processReleaseJob(
  job: WebhookJob,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  const log = deps.log ?? (() => undefined);
  const releaseLike = getReleaseFromPayload(job.payload);

  if (!releaseLike) {
    log({
      deliveryId: job.deliveryId,
      msg: "not a release payload; skipping",
    });
    return { status: "ignored_event", reason: "not_a_release_payload" };
  }

  const { tier, ruleId } = classifyEvent(releaseLike, deps.rules);
  log({
    deliveryId: job.deliveryId,
    releaseId: releaseLike.release.id,
    tier,
    ruleId,
  });

  if (tier !== "post-worthy") {
    return {
      status: "skipped",
      tier,
      ruleId,
    };
  }

  try {
    const client = deps.github;
    const enriched = client
      ? await enrichRelease(job.payload, client, releaseLike)
      : {
          owner: "local",
          repo: "fixture",
          releaseId: releaseLike.release.id,
          releaseName:
            releaseLike.release.name ?? releaseLike.release.tag_name,
          tagName: releaseLike.release.tag_name,
          body: releaseLike.release.body ?? "",
          diffStats: null,
        };

    await deps.draftAndWrite({
      deliveryId: job.deliveryId,
      eventName: job.eventName,
      tier: "post-worthy",
      ruleId,
      enriched,
      diffStats: enriched.diffStats,
    });

    return {
      status: "drafted",
      tier: "post-worthy",
      ruleId,
      enriched,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({
      deliveryId: job.deliveryId,
      releaseId: releaseLike.release.id,
      tier,
      ruleId,
      error: message,
    });
    return { status: "error", message };
  }
}
