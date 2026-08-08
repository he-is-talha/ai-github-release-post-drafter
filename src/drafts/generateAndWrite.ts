import { join } from "node:path";
import { generateDraft } from "../drafting/generate.js";
import type { LlmProvider } from "../llm/provider.js";
import type { Draft } from "../schema/draft.js";
import type { DraftAndWriteInput } from "../worker/processRelease.js";
import { writeDraftFiles } from "./writeDraft.js";

export type GenerateAndWriteResult = {
  paths: string[];
  filename: string;
  markdown: string;
  drafts: { linkedin: Draft; x: Draft };
};

export type CreateDraftAndWriteOptions = {
  llm: LlmProvider;
  draftsDir?: string;
};

/**
 * Real draftAndWrite implementation: generate LinkedIn + X drafts, write one md file.
 */
export function createDraftAndWrite(
  opts: CreateDraftAndWriteOptions,
): (input: DraftAndWriteInput) => Promise<GenerateAndWriteResult> {
  const draftsDir = opts.draftsDir ?? join(process.cwd(), "drafts");

  return async (input) => {
    const base = {
      releaseName: input.enriched.releaseName,
      tagName: input.enriched.tagName,
      body: input.enriched.body,
      diffStats: input.diffStats,
      tier: input.tier,
      ruleId: input.ruleId,
    } as const;

    const linkedinRaw = await generateDraft(
      { ...base, platform: "linkedin" },
      opts.llm,
    );
    const xRaw = await generateDraft({ ...base, platform: "x" }, opts.llm);

    const linkedin: Draft = {
      ...linkedinRaw,
      platform: "linkedin",
      tier: input.tier,
      ruleId: input.ruleId,
    };
    const x: Draft = {
      ...xRaw,
      platform: "x",
      tier: input.tier,
      ruleId: input.ruleId,
    };

    const written = await writeDraftFiles(
      draftsDir,
      {
        tier: input.tier,
        ruleId: input.ruleId,
        deliveryId: input.deliveryId,
        releaseId: input.enriched.releaseId,
        tag: input.enriched.tagName,
      },
      { linkedin, x },
    );

    return {
      paths: written.paths,
      filename: written.filename,
      markdown: written.markdown,
      drafts: { linkedin, x },
    };
  };
}
