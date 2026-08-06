import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  signGitHubBody,
  verifyGitHubSignature,
} from "../../src/github/hmac.js";

const SECRET = "test-webhook-secret";
const bodyPath = join(process.cwd(), "tests/fixtures/hmac/body.txt");
const rawBody = readFileSync(bodyPath);

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 signature for the fixture body", () => {
    // Algorithm: HMAC-SHA256(secret, rawBody bytes) → hex, prefixed with sha256=
    const signature = signGitHubBody(rawBody, SECRET);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifyGitHubSignature(rawBody, signature, SECRET)).toBe(true);
  });

  it("accepts the same signature when body is passed as utf8 string", () => {
    const asString = rawBody.toString("utf8");
    const signature = signGitHubBody(asString, SECRET);
    expect(verifyGitHubSignature(asString, signature, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = signGitHubBody(rawBody, SECRET);
    const tampered = Buffer.from(rawBody.toString("utf8") + "x", "utf8");
    expect(verifyGitHubSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyGitHubSignature(rawBody, undefined, SECRET)).toBe(false);
    expect(verifyGitHubSignature(rawBody, "", SECRET)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(verifyGitHubSignature(rawBody, "sha1=deadbeef", SECRET)).toBe(
      false,
    );
    expect(verifyGitHubSignature(rawBody, "sha256=not-hex", SECRET)).toBe(
      false,
    );
    expect(verifyGitHubSignature(rawBody, "sha256=abcd", SECRET)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const signature = signGitHubBody(rawBody, SECRET);
    expect(verifyGitHubSignature(rawBody, signature, "other-secret")).toBe(
      false,
    );
  });
});
