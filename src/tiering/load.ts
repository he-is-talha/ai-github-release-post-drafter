import fs from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DraftTierSchema } from "../schema/draft.js";
import type { TieringRule } from "./types.js";

type RawRulesFile = {
  rules?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRule(raw: unknown, index: number): TieringRule {
  if (!isObject(raw)) {
    throw new Error(`tiering.yaml rules[${index}] must be an object`);
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new Error(`tiering.yaml rules[${index}] missing string id`);
  }
  const tierParsed = DraftTierSchema.safeParse(raw.tier);
  if (!tierParsed.success) {
    throw new Error(
      `tiering.yaml rules[${index}] (${raw.id}) has invalid tier`,
    );
  }

  const rule: TieringRule = {
    id: raw.id,
    tier: tierParsed.data,
  };

  if (raw.tagPrefix !== undefined) {
    if (typeof raw.tagPrefix !== "string") {
      throw new Error(`tiering.yaml rules[${index}] tagPrefix must be string`);
    }
    rule.tagPrefix = raw.tagPrefix;
  }
  if (raw.nameIncludes !== undefined) {
    if (typeof raw.nameIncludes !== "string") {
      throw new Error(
        `tiering.yaml rules[${index}] nameIncludes must be string`,
      );
    }
    rule.nameIncludes = raw.nameIncludes;
  }
  if (raw.bodyIncludes !== undefined) {
    if (typeof raw.bodyIncludes !== "string") {
      throw new Error(
        `tiering.yaml rules[${index}] bodyIncludes must be string`,
      );
    }
    rule.bodyIncludes = raw.bodyIncludes;
  }
  if (raw.draft !== undefined) {
    if (typeof raw.draft !== "boolean") {
      throw new Error(`tiering.yaml rules[${index}] draft must be boolean`);
    }
    rule.draft = raw.draft;
  }
  if (raw.prerelease !== undefined) {
    if (typeof raw.prerelease !== "boolean") {
      throw new Error(
        `tiering.yaml rules[${index}] prerelease must be boolean`,
      );
    }
    rule.prerelease = raw.prerelease;
  }
  if (raw.requireBody !== undefined) {
    if (typeof raw.requireBody !== "boolean") {
      throw new Error(
        `tiering.yaml rules[${index}] requireBody must be boolean`,
      );
    }
    rule.requireBody = raw.requireBody;
  }
  if (raw.actions !== undefined) {
    if (
      !Array.isArray(raw.actions) ||
      !raw.actions.every((a) => typeof a === "string")
    ) {
      throw new Error(
        `tiering.yaml rules[${index}] actions must be string[]`,
      );
    }
    rule.actions = raw.actions as string[];
  }

  return rule;
}

export function loadTieringRules(path?: string): TieringRule[] {
  const filePath = path ?? join(process.cwd(), "tiering.yaml");
  const rawText = fs.readFileSync(filePath, "utf-8");
  const parsed = parseYaml(rawText) as RawRulesFile;
  if (!isObject(parsed) || !Array.isArray(parsed.rules)) {
    throw new Error("tiering.yaml must contain a top-level rules array");
  }
  if (parsed.rules.length === 0) {
    throw new Error("tiering.yaml rules array must not be empty");
  }
  return parsed.rules.map((rule, index) => parseRule(rule, index));
}
