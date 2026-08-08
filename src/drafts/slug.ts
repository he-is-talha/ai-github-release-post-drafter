/** Turn a release tag into a filesystem-safe slug. */
export function slugify(tagName: string): string {
  return tagName
    .trim()
    .toLowerCase()
    .replace(/^v/, "v")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "release";
}
