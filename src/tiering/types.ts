import type { Draft } from "../schema/draft.js";

export type TieringTier = Draft["tier"];

export type TieringRule = {
  id: string;
  tier: TieringTier;
  /** Match if release.tag_name starts with this (case-sensitive). */
  tagPrefix?: string;
  /** Match if release.name includes this substring. */
  nameIncludes?: string;
  /** Match if release.body includes this substring. */
  bodyIncludes?: string;
  /** Match if release.draft equals this. */
  draft?: boolean;
  /** Match if release.prerelease equals this. */
  prerelease?: boolean;
  /** Match if release.body is non-empty after trim. */
  requireBody?: boolean;
  /** Match if payload.action is one of these (when set). */
  actions?: string[];
};

export type ReleaseLike = {
  action?: string;
  release: {
    id: number | string;
    tag_name: string;
    name?: string | null;
    body?: string | null;
    draft: boolean;
    prerelease: boolean;
  };
};

export type ClassifyResult = {
  tier: TieringTier;
  ruleId: string;
};
