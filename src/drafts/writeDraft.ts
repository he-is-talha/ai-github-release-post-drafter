import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Draft } from "../schema/draft.js";
import { toFrontMatter, type DraftFrontMatter } from "./frontMatter.js";
import { slugify } from "./slug.js";

export type WriteDraftMeta = Omit<DraftFrontMatter, "platforms" | "createdAt"> & {
  createdAt?: string;
};

export type WriteDraftResult = {
  paths: string[];
  filename: string;
  markdown: string;
};

function formatPlatformSection(
  heading: string,
  draft: Draft,
): string {
  const tags = draft.tags.map((t) => `\`${t}\``).join(", ");
  return [
    `## ${heading}`,
    "",
    `**Hook:** ${draft.hook}`,
    "",
    draft.body,
    "",
    `**Tags:** ${tags || "(none)"}`,
  ].join("\n");
}

export function buildDraftMarkdown(
  meta: WriteDraftMeta,
  drafts: { linkedin: Draft; x: Draft },
): string {
  const createdAt =
    meta.createdAt ?? new Date().toISOString();
  const frontMatter = toFrontMatter({
    tier: meta.tier,
    ruleId: meta.ruleId,
    deliveryId: meta.deliveryId,
    releaseId: meta.releaseId,
    tag: meta.tag,
    platforms: ["linkedin", "x"],
    createdAt,
  });

  return [
    frontMatter,
    "",
    formatPlatformSection("LinkedIn", drafts.linkedin),
    "",
    formatPlatformSection("X", drafts.x),
    "",
  ].join("\n");
}

/**
 * Write one markdown file: `YYYY-MM-DD-{slug}.md` with LinkedIn + X sections.
 */
export async function writeDraftFiles(
  dir: string,
  meta: WriteDraftMeta,
  drafts: { linkedin: Draft; x: Draft },
): Promise<WriteDraftResult> {
  await mkdir(dir, { recursive: true });
  const date = (meta.createdAt ?? new Date().toISOString()).slice(0, 10);
  const filename = `${date}-${slugify(meta.tag)}.md`;
  const path = join(dir, filename);
  const markdown = buildDraftMarkdown(meta, drafts);
  await writeFile(path, markdown, "utf8");
  return { paths: [path], filename, markdown };
}
