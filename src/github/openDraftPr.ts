import { slugify } from "../drafts/slug.js";

export type OpenPrInput = {
  owner: string;
  repo: string;
  tagName: string;
  deliveryId: string;
  /** Path inside the repo, e.g. drafts/2026-08-08-v1-2-0.md */
  filePath: string;
  content: string;
  baseBranch?: string;
};

export type OpenPrResult = {
  prNumber: number;
  url: string;
  branch: string;
};

/**
 * Minimal GitHub surface needed to open a draft PR. Easy to mock in tests.
 */
export type DraftPrClient = {
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  getRefSha(owner: string, repo: string, ref: string): Promise<string>;
  createRef(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
  ): Promise<void>;
  createOrUpdateFile(params: {
    owner: string;
    repo: string;
    path: string;
    content: string;
    branch: string;
    message: string;
  }): Promise<void>;
  createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    head: string;
    base: string;
    body: string;
  }): Promise<{ number: number; html_url: string }>;
};

export function draftBranchName(tagName: string, deliveryId: string): string {
  const tagSlug = slugify(tagName);
  const deliveryShort = deliveryId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "local";
  return `draft/release-${tagSlug}-${deliveryShort}`;
}

function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  const message = String((err as { message?: string }).message ?? err);
  return status === 422 || /already exists|Reference already exists/i.test(message);
}

/**
 * Create a branch, commit the draft markdown, open a PR for human approval.
 * Never publishes to social platforms.
 */
export async function openDraftPr(
  client: DraftPrClient,
  input: OpenPrInput,
): Promise<OpenPrResult> {
  const base =
    input.baseBranch ??
    (await client.getDefaultBranch(input.owner, input.repo));
  const baseSha = await client.getRefSha(input.owner, input.repo, base);
  const branch = draftBranchName(input.tagName, input.deliveryId);

  try {
    await client.createRef(
      input.owner,
      input.repo,
      `refs/heads/${branch}`,
      baseSha,
    );
  } catch (err) {
    if (!isAlreadyExistsError(err)) {
      throw err;
    }
    // Branch already exists — continue and update the file on it.
  }

  await client.createOrUpdateFile({
    owner: input.owner,
    repo: input.repo,
    path: input.filePath,
    content: input.content,
    branch,
    message: `draft: social posts for ${input.tagName}`,
  });

  const title = `Draft posts for ${input.tagName}`;
  const body = [
    "## Human approval required",
    "",
    "This PR was opened by **ai-github-release-post-drafter**.",
    "Review the draft markdown, edit if needed, then post **manually**.",
    "",
    "- Do **not** auto-publish.",
    "- Closing without merging means you discarded this draft.",
    "",
    `Delivery: \`${input.deliveryId}\``,
    `Release tag: \`${input.tagName}\``,
  ].join("\n");

  let pr: { number: number; html_url: string };
  try {
    pr = await client.createPullRequest({
      owner: input.owner,
      repo: input.repo,
      title,
      head: branch,
      base,
      body,
    });
  } catch (err) {
    if (!isAlreadyExistsError(err)) {
      throw err;
    }
    // PR may already exist for this head — surface a clear skip-style result.
    throw new Error(
      `Pull request for branch ${branch} may already exist: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return {
    prNumber: pr.number,
    url: pr.html_url,
    branch,
  };
}
