export type Platforms = "linkedin" | "x";

export type DraftFrontMatter = {
  tier: string;
  ruleId: string;
  deliveryId: string;
  releaseId: string | number;
  tag: string;
  platforms: Array<Platforms>;
  createdAt: string;
};

function yamlScalar(value: string | number): string {
  const text = String(value);
  if (/[:#\[\]{},&*?|>!%@`]/.test(text) || text.includes("\n")) {
    return JSON.stringify(text);
  }
  return text;
}

export function toFrontMatter(fields: DraftFrontMatter): string {
  const lines = [
    "---",
    `tier: ${yamlScalar(fields.tier)}`,
    `ruleId: ${yamlScalar(fields.ruleId)}`,
    `deliveryId: ${yamlScalar(fields.deliveryId)}`,
    `releaseId: ${yamlScalar(fields.releaseId)}`,
    `tag: ${yamlScalar(fields.tag)}`,
    "platforms:",
    ...fields.platforms.map((p) => `  - ${p}`),
    `createdAt: ${yamlScalar(fields.createdAt)}`,
    "---",
  ];
  return lines.join("\n");
}
