import type { PrismaClient, TickerPnlDaily, TickerPnlTotal } from "@prisma/client";
import type { RedisClientType } from "redis";
import { getPnlCacheVersion, pnlTickerTimelineCacheKey, pnlTotalsCacheKey } from "./pnlCache";

const CACHE_TTL_SECONDS = 60;

type TotalsSnapshot = Omit<TickerPnlTotal, "userId">;
type DailySnapshot = Omit<TickerPnlDaily, "userId">;

type CachedTotalsPayload = {
  items: Array<{
    symbol: string;
    baseCurrency: string;
    realizedPnlMinor: string;
    unrealizedPnlMinor: string;
    optionPremiumsMinor: string;
    dividendsMinor: string;
    feesMinor: string;
    netPnlMinor: string;
    lastRecomputedAt: string;
  }>;
};

type CachedDailyPayload = {
  items: Array<{
    symbol: string;
    baseCurrency: string;
    date: string;
    netPnlMinor: string;
    marketValueMinor: string;
    realizedPnlMinor: string;
    unrealizedPnlMinor: string;
  }>;
};

function toTotalsSnapshot(item: CachedTotalsPayload["items"][number]): TotalsSnapshot {
  return {
    symbol: item.symbol,
    baseCurrency: item.baseCurrency,
    realizedPnlMinor: BigInt(item.realizedPnlMinor),
    unrealizedPnlMinor: BigInt(item.unrealizedPnlMinor),
    optionPremiumsMinor: BigInt(item.optionPremiumsMinor),
    dividendsMinor: BigInt(item.dividendsMinor),
    feesMinor: BigInt(item.feesMinor),
    netPnlMinor: BigInt(item.netPnlMinor),
    lastRecomputedAt: new Date(item.lastRecomputedAt),
  };
}

function toDailySnapshot(item: CachedDailyPayload["items"][number]): DailySnapshot {
  return {
    symbol: item.symbol,
    baseCurrency: item.baseCurrency,
    date: new Date(item.date),
    netPnlMinor: BigInt(item.netPnlMinor),
    marketValueMinor: BigInt(item.marketValueMinor),
    realizedPnlMinor: BigInt(item.realizedPnlMinor),
    unrealizedPnlMinor: BigInt(item.unrealizedPnlMinor),
  };
}

function serializeTotals(rows: TotalsSnapshot[]): CachedTotalsPayload {
  return {
    items: rows.map((row) => ({
      symbol: row.symbol,
      baseCurrency: row.baseCurrency,
      realizedPnlMinor: row.realizedPnlMinor.toString(),
      unrealizedPnlMinor: row.unrealizedPnlMinor.toString(),
      optionPremiumsMinor: row.optionPremiumsMinor.toString(),
      dividendsMinor: row.dividendsMinor.toString(),
      feesMinor: row.feesMinor.toString(),
      netPnlMinor: row.netPnlMinor.toString(),
      lastRecomputedAt: row.lastRecomputedAt.toISOString(),
    })),
  };
}

function serializeDaily(rows: DailySnapshot[]): CachedDailyPayload {
  return {
    items: rows.map((row) => ({
      symbol: row.symbol,
      baseCurrency: row.baseCurrency,
      date: row.date.toISOString().slice(0, 10),
      netPnlMinor: row.netPnlMinor.toString(),
      marketValueMinor: row.marketValueMinor.toString(),
      realizedPnlMinor: row.realizedPnlMinor.toString(),
      unrealizedPnlMinor: row.unrealizedPnlMinor.toString(),
    })),
  };
}

export async function getTickerPnlTotalsCached(input: {
  prisma: PrismaClient;
  redis?: RedisClientType;
  userId: string;
  baseCurrency: string;
}): Promise<TotalsSnapshot[]> {
  const version = await getPnlCacheVersion(input.redis, input.userId, input.baseCurrency);
  const key = pnlTotalsCacheKey(input.userId, input.baseCurrency, version);

  if (input.redis) {
    try {
      const cached = await input.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedTotalsPayload;
        if (parsed?.items?.length) return parsed.items.map(toTotalsSnapshot);
        return [];
      }
    } catch {
      // ignore cache errors
    }
  }

  const rows = await input.prisma.tickerPnlTotal.findMany({
    where: { userId: input.userId, baseCurrency: input.baseCurrency },
    orderBy: { symbol: "asc" },
  });

  const snapshots: TotalsSnapshot[] = rows.map((row) => ({
    symbol: row.symbol,
    baseCurrency: row.baseCurrency,
    realizedPnlMinor: row.realizedPnlMinor,
    unrealizedPnlMinor: row.unrealizedPnlMinor,
    optionPremiumsMinor: row.optionPremiumsMinor,
    dividendsMinor: row.dividendsMinor,
    feesMinor: row.feesMinor,
    netPnlMinor: row.netPnlMinor,
    lastRecomputedAt: row.lastRecomputedAt,
  }));

  if (input.redis) {
    try {
      await input.redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(serializeTotals(snapshots)));
    } catch {
      // ignore cache errors
    }
  }

  return snapshots;
}

export async function getTickerPnlTimelineCached(input: {
  prisma: PrismaClient;
  redis?: RedisClientType;
  userId: string;
  baseCurrency: string;
  symbol: string;
}): Promise<DailySnapshot[]> {
  const version = await getPnlCacheVersion(input.redis, input.userId, input.baseCurrency);
  const key = pnlTickerTimelineCacheKey(input.userId, input.baseCurrency, input.symbol, version);

  if (input.redis) {
    try {
      const cached = await input.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedDailyPayload;
        if (parsed?.items?.length) return parsed.items.map(toDailySnapshot);
        return [];
      }
    } catch {
      // ignore cache errors
    }
  }

  const rows = await input.prisma.tickerPnlDaily.findMany({
    where: { userId: input.userId, baseCurrency: input.baseCurrency, symbol: input.symbol },
    orderBy: { date: "asc" },
  });

  const snapshots: DailySnapshot[] = rows.map((row) => ({
    symbol: row.symbol,
    baseCurrency: row.baseCurrency,
    date: row.date,
    netPnlMinor: row.netPnlMinor,
    marketValueMinor: row.marketValueMinor,
    realizedPnlMinor: row.realizedPnlMinor,
    unrealizedPnlMinor: row.unrealizedPnlMinor,
  }));

  if (input.redis) {
    try {
      await input.redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(serializeDaily(snapshots)));
    } catch {
      // ignore cache errors
    }
  }

  return snapshots;
}
