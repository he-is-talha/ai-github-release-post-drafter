import { createHmac, timingSafeEqual } from "node:crypto";

function toBuffer(rawBody: Buffer | string): Buffer {
  return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
}

/**
 * Verify GitHub's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body).
 * Always HMAC the raw request bytes — never a re-serialized JSON string.
 */
export function verifyGitHubSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (signatureHeader === undefined || signatureHeader === "") {
    return false;
  }
  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }
  if (secret === "") {
    return false;
  }

  const providedHex = signatureHeader.slice("sha256=".length);
  if (!/^[0-9a-f]+$/i.test(providedHex) || providedHex.length !== 64) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret)
    .update(toBuffer(rawBody))
    .digest("hex");

  const provided = Buffer.from(providedHex, "utf8");
  const expected = Buffer.from(expectedHex, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

/** Test/helper: build a valid X-Hub-Signature-256 for a body + secret. */
export function signGitHubBody(
  rawBody: Buffer | string,
  secret: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(toBuffer(rawBody))
    .digest("hex");
  return `sha256=${digest}`;
}
