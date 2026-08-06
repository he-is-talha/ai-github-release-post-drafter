import fs from "node:fs";
import { join } from "node:path";
import type { DiffStats, DraftPromptInput } from "./types.js";

export function loadStyleGuide(path?: string): string {
  const defaultPath = path ?? join(process.cwd(), "style-guide.md");
  return fs.readFileSync(defaultPath, "utf-8");
}

function formatDiffStats(diffStats: DiffStats): string {
  if (diffStats == null) {
    return "unavailable";
  }
  const parts: string[] = [];
  if (diffStats.commits != null) parts.push(`commits=${diffStats.commits}`);
  if (diffStats.additions != null) parts.push(`additions=${diffStats.additions}`);
  if (diffStats.deletions != null) parts.push(`deletions=${diffStats.deletions}`);
  if (diffStats.filesChanged != null) {
    parts.push(`filesChanged=${diffStats.filesChanged}`);
  }
  return parts.length > 0 ? parts.join(", ") : "unavailable";
}

function platformTargetHint(platform: DraftPromptInput["platform"]): string {
  if (platform === "linkedin") {
    return "LinkedIn: body character target 900–1400.";
  }
  return "X: body character target 200–260 (stay under ~280).";
}

export function buildDraftPrompt(input: DraftPromptInput): string {
  const styleGuide = loadStyleGuide();

  return [
    "## System instructions",
    "You draft a platform-specific social post from a GitHub release.",
    "Obey the style guide below. No emoji. Do not use banned phrases or close paraphrases.",
    "Echo the given tier and ruleId — do not invent a new classification.",
    "Return JSON only. No markdown fences, no preamble, no commentary.",
    "",
    "## Style guide",
    styleGuide.trim(),
    "",
    "## Release facts",
    `releaseName: ${input.releaseName}`,
    `tagName: ${input.tagName}`,
    `platform: ${input.platform}`,
    `platformTarget: ${platformTargetHint(input.platform)}`,
    `tier: ${input.tier}`,
    `ruleId: ${input.ruleId}`,
    `diffStats: ${formatDiffStats(input.diffStats)}`,
    "releaseNotes:",
    input.body.trim() || "(empty)",
    "",
    "## Required JSON object keys",
    "Return a single JSON object with exactly these keys:",
    '- "hook": string (non-empty, max 200 chars) — opening line',
    '- "body": string (non-empty) — main post text for the platform',
    '- "tags": string[] (max 8, each non-empty) — topic labels, no # prefix',
    '- "tier": must equal the tier given above',
    '- "ruleId": must equal the ruleId given above',
    `- "platform": must be "${input.platform}"`,
  ].join("\n");
}
