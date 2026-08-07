import {
  deliveryKey,
  type ClaimResult,
  type IdempotencyStore,
} from "./types.js";

/** Single-process only — fine for unit tests and local fixture replay. */
export function createMemoryIdempotencyStore(): IdempotencyStore {
  const seen = new Set<string>();

  return {
    async tryClaim(deliveryId: string): Promise<ClaimResult> {
      const key = deliveryKey(deliveryId);
      if (seen.has(key)) {
        return "duplicate";
      }
      seen.add(key);
      return "claimed";
    },
  };
}
