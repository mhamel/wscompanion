import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { NewsRssFeedConfig } from "./config";
import { parseRssOrAtom } from "./rss";

type RedisCache = {
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttlSeconds: number, value: string) => Promise<unknown>;
};

type FeedMeta = {
  etag?: string;
  lastModified?: string;
};

const FEED_META_TTL_SECONDS = 60 * 60 * 24 * 7;

function metaKey(url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  return `news:feedmeta:${hash}`;
}

async function loadFeedMeta(redis: RedisCache | undefined, url: string): Promise<FeedMeta> {
  if (!redis) return {};
  try {
    const raw = await redis.get(metaKey(url));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const obj = parsed as Record<string, unknown>;
    return {
      etag: typeof obj.etag === "string" ? obj.etag : undefined,
      lastModified: typeof obj.lastModified === "string" ? obj.lastModified : undefined,
    };
  } catch {
    return {};
  }
}

async function saveFeedMeta(
  redis: RedisCache | undefined,
  url: string,
  meta: FeedMeta,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(metaKey(url), FEED_META_TTL_SECONDS, JSON.stringify(meta));
  } catch {
    // ignore cache failures
  }
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function uniqueSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const safe = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  return safe;
}

export type IngestNewsFeedResult = {
  fetched: boolean;
  itemsParsed: number;
  itemsInserted: number;
  symbolsLinked: number;
};

export async function ingestNewsRssFeed(input: {
  prisma: PrismaClient;
  redis?: RedisCache;
  feed: NewsRssFeedConfig;
}): Promise<IngestNewsFeedResult> {
  const meta = await loadFeedMeta(input.redis, input.feed.url);

  const headers: Record<string, string> = {
    "User-Agent": "justlovethestocks/0.0 (news-ingest)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  };

  if (meta.etag) headers["If-None-Match"] = meta.etag;
  if (meta.lastModified) headers["If-Modified-Since"] = meta.lastModified;

  const res = await fetch(input.feed.url, { headers });
  if (res.status === 304) {
    return { fetched: false, itemsParsed: 0, itemsInserted: 0, symbolsLinked: 0 };
  }
  if (!res.ok) {
    throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
  }

  const etag = res.headers.get("etag") ?? undefined;
  const lastModified = res.headers.get("last-modified") ?? undefined;
  await saveFeedMeta(input.redis, input.feed.url, { etag, lastModified });

  const xml = await res.text();
  const parsed = parseRssOrAtom(xml);

  const itemsParsed = parsed.length;
  if (itemsParsed === 0) {
    return { fetched: true, itemsParsed, itemsInserted: 0, symbolsLinked: 0 };
  }

  const symbols = uniqueSymbols(input.feed.symbols);
  const provider = input.feed.provider;

  const urlHashes = parsed.map((item) => item.urlHash);

  const insertResult = await input.prisma.newsItem.createMany({
    data: parsed.map((item) => ({
      provider,
      externalId: item.externalId ?? null,
      url: item.url,
      urlHash: item.urlHash,
      title: item.title,
      publisher: item.publisher ?? null,
      publishedAt: item.publishedAt,
      raw: toJsonValue(item.raw),
    })),
    skipDuplicates: true,
  });

  const rows = await input.prisma.newsItem.findMany({
    where: { urlHash: { in: urlHashes } },
    select: { id: true },
  });

  const symbolsData = [];
  for (const row of rows) {
    for (const symbol of symbols) {
      symbolsData.push({ newsItemId: row.id, symbol });
    }
  }

  const linkResult =
    symbolsData.length > 0
      ? await input.prisma.newsItemSymbol.createMany({ data: symbolsData, skipDuplicates: true })
      : { count: 0 };

  return {
    fetched: true,
    itemsParsed,
    itemsInserted: insertResult.count,
    symbolsLinked: linkResult.count,
  };
}
