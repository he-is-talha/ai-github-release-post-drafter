import { Octokit } from "@octokit/rest";
import type { DraftPrClient } from "./openDraftPr.js";

/**
 * Octokit-backed DraftPrClient for real PR opens (behind OPEN_PR + GITHUB_TOKEN).
 */
export function createDraftPrClient(token: string): DraftPrClient {
  const octokit = new Octokit({
    auth: token,
    log: {
      debug: () => undefined,
      info: () => undefined,
      warn: (message: string) => {
        console.warn(message);
      },
      error: (message: string) => {
        // Expected 404 while probing file existence — don't spam the console/GIF.
        if (/^(GET|POST|PATCH|PUT|DELETE) \//.test(message)) return;
        console.error(message);
      },
    },
  });

  return {
    async getDefaultBranch(owner, repo) {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      return data.default_branch;
    },

    async getRefSha(owner, repo, ref) {
      const normalized = ref.startsWith("refs/") ? ref : `heads/${ref}`;
      const { data } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: normalized.replace(/^refs\//, ""),
      });
      return data.object.sha;
    },

    async createRef(owner, repo, ref, sha) {
      await octokit.rest.git.createRef({ owner, repo, ref, sha });
    },

    async createOrUpdateFile({
      owner,
      repo,
      path,
      content,
      branch,
      message,
    }) {
      let sha: string | undefined;
      try {
        const existing = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });
        if (!Array.isArray(existing.data) && "sha" in existing.data) {
          sha = existing.data.sha;
        }
      } catch {
        // File does not exist yet on this branch.
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        sha,
      });
    },

    async createPullRequest({ owner, repo, title, head, base, body }) {
      const { data } = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
      });
      return { number: data.number, html_url: data.html_url };
    },
  };
}

export function parseGithubRepo(
  value: string | undefined,
): { owner: string; repo: string } | null {
  if (!value) return null;
  const [owner, repo] = value.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}
