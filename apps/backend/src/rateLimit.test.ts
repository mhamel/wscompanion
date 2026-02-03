import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { createMemoryRateLimitStore, enforceRateLimit } from "./rateLimit";

describe("rateLimit", () => {
  it("allows up to max within the window", async () => {
    const store = createMemoryRateLimitStore();

    await expect(
      enforceRateLimit({ store, key: "k", max: 2, windowSeconds: 60, nowMs: 1_000 }),
    ).resolves.toBeUndefined();
    await expect(
      enforceRateLimit({ store, key: "k", max: 2, windowSeconds: 60, nowMs: 1_000 }),
    ).resolves.toBeUndefined();
    await expect(
      enforceRateLimit({ store, key: "k", max: 2, windowSeconds: 60, nowMs: 1_000 }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("resets after the window", async () => {
    const store = createMemoryRateLimitStore();

    await enforceRateLimit({ store, key: "k", max: 1, windowSeconds: 10, nowMs: 0 });
    await expect(
      enforceRateLimit({ store, key: "k", max: 1, windowSeconds: 10, nowMs: 0 }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      enforceRateLimit({ store, key: "k", max: 1, windowSeconds: 10, nowMs: 11_000 }),
    ).resolves.toBeUndefined();
  });
});
