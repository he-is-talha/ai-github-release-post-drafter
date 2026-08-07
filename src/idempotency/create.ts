import { createMemoryIdempotencyStore } from "./memoryStore.js";
import { createIdempotencyStore } from "./redisStore.js";
import type { IdempotencyStore } from "./types.js";

export type IdempotencyBackend = "memory" | "redis";

export function createIdempotencyBackend(opts: {
  backend: IdempotencyBackend;
  redisUrl?: string;
}): IdempotencyStore {
  if (opts.backend === "memory") {
    return createMemoryIdempotencyStore();
  }
  if (!opts.redisUrl) {
    throw new Error("REDIS_URL is required when IDEMPOTENCY_BACKEND=redis");
  }
  return createIdempotencyStore(opts.redisUrl);
}
