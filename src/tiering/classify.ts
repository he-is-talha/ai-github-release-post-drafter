import type {
  ClassifyResult,
  ReleaseLike,
  TieringRule,
} from "./types.js";

function ruleMatches(payload: ReleaseLike, rule: TieringRule): boolean {
  const { release } = payload;
  const body = release.body ?? "";
  const name = release.name ?? "";

  if (rule.tagPrefix !== undefined) {
    if (!release.tag_name.startsWith(rule.tagPrefix)) {
      return false;
    }
  }
  if (rule.nameIncludes !== undefined) {
    if (!name.includes(rule.nameIncludes)) {
      return false;
    }
  }
  if (rule.bodyIncludes !== undefined) {
    if (!body.includes(rule.bodyIncludes)) {
      return false;
    }
  }
  if (rule.draft !== undefined && release.draft !== rule.draft) {
    return false;
  }
  if (rule.prerelease !== undefined && release.prerelease !== rule.prerelease) {
    return false;
  }
  if (rule.requireBody === true && body.trim().length === 0) {
    return false;
  }
  if (rule.actions !== undefined) {
    if (payload.action === undefined || !rule.actions.includes(payload.action)) {
      return false;
    }
  }
  return true;
}

/**
 * Classify a release-like webhook payload. First matching rule wins.
 * Rules with no matchers (e.g. default-ignore) match everything.
 */
export function classifyEvent(
  payload: ReleaseLike,
  rules: TieringRule[],
): ClassifyResult {
  for (const rule of rules) {
    if (ruleMatches(payload, rule)) {
      return { tier: rule.tier, ruleId: rule.id };
    }
  }
  // Safety net if YAML omitted default-ignore
  return { tier: "ignore", ruleId: "fallback-ignore" };
}
