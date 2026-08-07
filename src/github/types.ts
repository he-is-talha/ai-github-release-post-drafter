import type { DiffStats } from "../drafting/types.js";

export type DiffCompareStats = {
  commits: number;
  additions: number;
  deletions: number;
  filesChanged: number;
};

export type GitHubReleaseDetails = {
  id: number | string;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
};

export type GitHubClient = {
  getRelease(
    owner: string,
    repo: string,
    releaseId: number | string,
  ): Promise<GitHubReleaseDetails>;
  compareTags(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<DiffCompareStats>;
};

export type EnrichedRelease = {
  owner: string;
  repo: string;
  releaseId: number | string;
  releaseName: string;
  tagName: string;
  body: string;
  diffStats: DiffStats;
};
