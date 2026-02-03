import crypto from "node:crypto";
import { AppError } from "./errors";

type RedisLike = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  ttl: (key: string) => Promise<number>;
};

export type RateLimitStore = {
  increment: (input: {
    key: string;
    windowSeconds: number;
    nowMs: number;
  }) => Promise<{ count: number; retryAfterSeconds: number }>;
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashRateLimitKeyPart(value: string): string {
  return sha256Hex(value.trim());
}

export function createMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAtMs: number }>();

  return {
    async increment(input) {
      const bucket = buckets.get(input.key);
      if (!bucket || input.nowMs >= bucket.resetAtMs) {
        const resetAtMs = input.nowMs + input.windowSeconds * 1000;
        buckets.set(input.key, { count: 1, resetAtMs });
        return {
          count: 1,
          retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - input.nowMs) / 1000)),
        };
      }

      bucket.count += 1;
      return {
        count: bucket.count,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - input.nowMs) / 1000)),
      };
    },
  };
}

export function createRedisRateLimitStore(redis: RedisLike): RateLimitStore {
  return {
    async increment(input) {
      const count = await redis.incr(input.key);
      if (count === 1) {
        await redis.expire(input.key, input.windowSeconds);
      }

      let ttlSeconds = input.windowSeconds;
      if (count > 1) {
        const ttl = await redis.ttl(input.key);
        ttlSeconds = ttl > 0 ? ttl : input.windowSeconds;
      }

      return { count, retryAfterSeconds: ttlSeconds };
    },
  };
}

const defaultMemoryStore = createMemoryRateLimitStore();

export function getRequestRateLimitStore(redis?: RedisLike | null): RateLimitStore {
  return redis ? createRedisRateLimitStore(redis) : defaultMemoryStore;
}

export async function enforceRateLimit(input: {
  store: RateLimitStore;
  key: string;
  max: number;
  windowSeconds: number;
  nowMs?: number;
  code?: string;
  message?: string;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const max = Number.isFinite(input.max) && input.max > 0 ? input.max : 1;
  const windowSeconds =
    Number.isFinite(input.windowSeconds) && input.windowSeconds > 0 ? input.windowSeconds : 60;

  const result = await input.store.increment({ key: input.key, windowSeconds, nowMs });

  if (result.count > max) {
    throw new AppError({
      code: input.code ?? "RATE_LIMITED",
      message: input.message ?? "Try again later",
      statusCode: 429,
      details: { retryAfterSeconds: result.retryAfterSeconds },
    });
  }
}
