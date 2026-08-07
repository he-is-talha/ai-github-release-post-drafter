import type { DiffStats } from "../drafting/types.js";
import {
  getReleaseFromPayload,
  getRepoFromPayload,
} from "./extractRelease.js";
import type {
  DiffCompareStats,
  EnrichedRelease,
  GitHubClient,
  GitHubReleaseDetails,
} from "./types.js";
import type { ReleaseLike } from "../tiering/types.js";

/**
 * Fixture/local client: notes from the webhook payload; zeros for compare.
 */
export function createFixtureGitHubClient(payload: unknown): GitHubClient {
  const releaseLike = getReleaseFromPayload(payload);

  return {
    async getRelease(
      _owner: string,
      _repo: string,
      releaseId: number | string,
    ): Promise<GitHubReleaseDetails> {
      if (!releaseLike) {
        throw new Error("fixture payload missing release");
      }
      return {
        id: releaseId,
        tagName: releaseLike.release.tag_name,
        name: releaseLike.release.name ?? releaseLike.release.tag_name,
        body: releaseLike.release.body ?? "",
        draft: releaseLike.release.draft,
        prerelease: releaseLike.release.prerelease,
      };
    },

    async compareTags(): Promise<DiffCompareStats> {
      return { commits: 0, additions: 0, deletions: 0, filesChanged: 0 };
    },
  };
}

export async function enrichRelease(
  payload: unknown,
  client: GitHubClient,
  releaseLike?: ReleaseLike | null,
): Promise<EnrichedRelease> {
  const release = releaseLike ?? getReleaseFromPayload(payload);
  if (!release) {
    throw new Error("cannot enrich: payload is not a release event");
  }

  const repoInfo = getRepoFromPayload(payload) ?? {
    owner: "local",
    repo: "fixture",
  };

  let body = release.release.body ?? "";
  let releaseName = release.release.name ?? release.release.tag_name;
  let tagName = release.release.tag_name;

  try {
    const details = await client.getRelease(
      repoInfo.owner,
      repoInfo.repo,
      release.release.id,
    );
    body = details.body || body;
    releaseName = details.name || releaseName;
    tagName = details.tagName || tagName;
  } catch {
    // Keep payload fields when getRelease fails (fixture / offline).
  }

  let diffStats: DiffStats = null;
  try {
    diffStats = await client.compareTags(
      repoInfo.owner,
      repoInfo.repo,
      `${tagName}~1`,
      tagName,
    );
  } catch {
    // Tag compare 404 / unavailable → notes-only.
    diffStats = null;
  }

  return {
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    releaseId: release.release.id,
    releaseName,
    tagName,
    body,
    diffStats,
  };
}
