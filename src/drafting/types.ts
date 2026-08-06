import type { Draft } from "../schema/draft.js";

export type DiffStats = {
    commits?: number;
    additions?: number;
    deletions?: number;
    filesChanged?: number;
} | null;

export type DraftPromptInput = {
    releaseName: string;
    tagName: string;
    body: string;
    diffStats: DiffStats;
    tier: Draft["tier"];
    ruleId: string;
    platform: Draft["platform"];
}