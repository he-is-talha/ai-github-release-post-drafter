import { describe, expect, it } from "vitest";
import { createMemoryIdempotencyStore } from "../../src/idempotency/memoryStore.js";

describe("memory idempotency store", () => {
  it("claims once and marks the second try as duplicate", async () => {
    const store = createMemoryIdempotencyStore();
    await expect(store.tryClaim("abc-123")).resolves.toBe("claimed");
    await expect(store.tryClaim("abc-123")).resolves.toBe("duplicate");
  });

  it("allows distinct delivery ids", async () => {
    const store = createMemoryIdempotencyStore();
    await expect(store.tryClaim("one")).resolves.toBe("claimed");
    await expect(store.tryClaim("two")).resolves.toBe("claimed");
  });
});
