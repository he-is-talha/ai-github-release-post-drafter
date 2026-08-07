import type { ReleaseLike } from "../tiering/types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Slim extractor: pull ReleaseLike fields from a GitHub webhook payload.
 */
export function getReleaseFromPayload(payload: unknown): ReleaseLike | null {
  if (!isObject(payload)) return null;
  const release = payload.release;
  if (!isObject(release)) return null;
  if (typeof release.tag_name !== "string") return null;
  if (typeof release.draft !== "boolean") return null;
  if (typeof release.prerelease !== "boolean") return null;
  if (release.id === undefined || release.id === null) return null;

  return {
    action: typeof payload.action === "string" ? payload.action : undefined,
    release: {
      id: release.id as number | string,
      tag_name: release.tag_name,
      name: typeof release.name === "string" ? release.name : null,
      body: typeof release.body === "string" ? release.body : null,
      draft: release.draft,
      prerelease: release.prerelease,
    },
  };
}

export function getRepoFromPayload(
  payload: unknown,
): { owner: string; repo: string } | null {
  if (!isObject(payload)) return null;
  const repository = payload.repository;
  if (!isObject(repository)) return null;

  if (typeof repository.full_name === "string") {
    const [owner, repo] = repository.full_name.split("/");
    if (owner && repo) return { owner, repo };
  }

  const ownerObj = repository.owner;
  const name = repository.name;
  if (
    isObject(ownerObj) &&
    typeof ownerObj.login === "string" &&
    typeof name === "string"
  ) {
    return { owner: ownerObj.login, repo: name };
  }
  return null;
}
