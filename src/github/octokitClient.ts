import { Octokit } from "@octokit/rest";
import type {
  DiffCompareStats,
  GitHubClient,
  GitHubReleaseDetails,
} from "./types.js";

export function createGitHubClient(token?: string): GitHubClient {
  const octokit = new Octokit(token ? { auth: token } : {});

  return {
    async getRelease(
      owner: string,
      repo: string,
      releaseId: number | string,
    ): Promise<GitHubReleaseDetails> {
      const { data } = await octokit.rest.repos.getRelease({
        owner,
        repo,
        release_id: Number(releaseId),
      });
      return {
        id: data.id,
        tagName: data.tag_name,
        name: data.name ?? data.tag_name,
        body: data.body ?? "",
        draft: data.draft,
        prerelease: data.prerelease,
      };
    },

    async compareTags(
      owner: string,
      repo: string,
      base: string,
      head: string,
    ): Promise<DiffCompareStats> {
      const { data } = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base,
        head,
      });
      return {
        commits: data.commits?.length ?? data.total_commits ?? 0,
        additions: data.files?.reduce((n, f) => n + (f.additions ?? 0), 0) ?? 0,
        deletions: data.files?.reduce((n, f) => n + (f.deletions ?? 0), 0) ?? 0,
        filesChanged: data.files?.length ?? 0,
      };
    },
  };
}
