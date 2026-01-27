const VERSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function pnlCacheVersionKey(userId: string, baseCurrency: string): string {
  return `pnl:ver:${userId}:${normalizeCurrency(baseCurrency)}`;
}

export function pnlTotalsCacheKey(userId: string, baseCurrency: string, version: string): string {
  return `pnl:totals:${userId}:${normalizeCurrency(baseCurrency)}:v${version}`;
}

export function pnlTickerSummaryCacheKey(
  userId: string,
  baseCurrency: string,
  symbol: string,
  version: string,
): string {
  return `pnl:summary:${userId}:${normalizeCurrency(baseCurrency)}:${symbol.trim().toUpperCase()}:v${version}`;
}

export function pnlTickerTimelineCacheKey(
  userId: string,
  baseCurrency: string,
  symbol: string,
  version: string,
): string {
  return `pnl:timeline:${userId}:${normalizeCurrency(baseCurrency)}:${symbol.trim().toUpperCase()}:v${version}`;
}

type RedisGet = { get: (key: string) => Promise<string | null> };
type RedisIncr = {
  incr: (key: string) => Promise<number>;
  expire?: (key: string, seconds: number) => Promise<unknown>;
};

export async function getPnlCacheVersion(
  redis: RedisGet | undefined,
  userId: string,
  baseCurrency: string,
): Promise<string> {
  if (!redis) return "0";
  try {
    const v = await redis.get(pnlCacheVersionKey(userId, baseCurrency));
    return v && v.trim() ? v.trim() : "0";
  } catch {
    return "0";
  }
}

export async function bumpPnlCacheVersion(
  redis: RedisIncr | undefined,
  userId: string,
  baseCurrency: string,
): Promise<number | null> {
  if (!redis) return null;
  const key = pnlCacheVersionKey(userId, baseCurrency);
  try {
    const next = await redis.incr(key);
    try {
      await redis.expire?.(key, VERSION_TTL_SECONDS);
    } catch {
      // ignore ttl errors
    }
    return next;
  } catch {
    return null;
  }
}
