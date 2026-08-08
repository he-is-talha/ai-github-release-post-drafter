import type { DiffStats } from "../drafting/types.js";
import type { OpenPrResult } from "../github/openDraftPr.js";
import { enrichRelease } from "../github/enrich.js";
import { getReleaseFromPayload } from "../github/extractRelease.js";
import type { EnrichedRelease, GitHubClient } from "../github/types.js";
import {
  incrementDraftFailure,
  incrementDraftSuccess,
  incrementTier,
  type Counters,
} from "../metrics/counters.js";
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

export type DraftAndWriteResult = {
  paths?: string[];
  filename?: string;
  markdown?: string;
};

export type OpenPrContext = {
  input: DraftAndWriteInput;
  write: DraftAndWriteResult;
};

export type ProcessDeps = {
  rules: TieringRule[];
  draftAndWrite: (
    input: DraftAndWriteInput,
  ) => Promise<DraftAndWriteResult | void>;
  github?: GitHubClient;
  /**
   * Optional PR opener. When omitted or returns null, drafts stay local only.
   */
  openPr?: (ctx: OpenPrContext) => Promise<OpenPrResult | null>;
  counters?: Counters;
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
      paths?: string[];
      pr?: OpenPrResult;
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
  if (deps.counters) {
    incrementTier(deps.counters, tier);
  }
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

    const draftInput: DraftAndWriteInput = {
      deliveryId: job.deliveryId,
      eventName: job.eventName,
      tier: "post-worthy",
      ruleId,
      enriched,
      diffStats: enriched.diffStats,
    };

    const writeResult = (await deps.draftAndWrite(draftInput)) ?? {};

    let pr: OpenPrResult | undefined;
    if (deps.openPr) {
      const opened = await deps.openPr({
        input: draftInput,
        write: writeResult,
      });
      if (opened) {
        pr = opened;
        log({
          deliveryId: job.deliveryId,
          msg: "draft PR opened",
          prNumber: opened.prNumber,
          url: opened.url,
        });
      } else {
        log({
          deliveryId: job.deliveryId,
          msg: "draft written locally; PR skipped",
        });
      }
    } else {
      log({
        deliveryId: job.deliveryId,
        msg: "draft written locally; PR skipped",
      });
    }

    if (deps.counters) {
      incrementDraftSuccess(deps.counters);
    }

    return {
      status: "drafted",
      tier: "post-worthy",
      ruleId,
      enriched,
      paths: writeResult.paths,
      pr,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (deps.counters) {
      incrementDraftFailure(deps.counters);
    }
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
