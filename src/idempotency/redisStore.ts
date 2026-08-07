import { Redis } from "ioredis";
import {
  DELIVERY_TTL_SECONDS,
  deliveryKey,
  type ClaimResult,
  type IdempotencyStore,
} from "./types.js";

export type RedisIdempotencyStoreOptions = {
  redisUrl: string;
  ttlSeconds?: number;
};

export function createIdempotencyStore(
  redisUrl: string,
  ttlSeconds: number = DELIVERY_TTL_SECONDS,
): IdempotencyStore {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  return {
    async tryClaim(deliveryId: string): Promise<ClaimResult> {
      if (redis.status === "wait") {
        await redis.connect();
      }
      const result = await redis.set(
        deliveryKey(deliveryId),
        "1",
        "EX",
        ttlSeconds,
        "NX",
      );
      return result === "OK" ? "claimed" : "duplicate";
    },
    async close(): Promise<void> {
      await redis.quit();
    },
  };
}
