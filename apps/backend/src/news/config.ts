export type NewsRssFeedConfig = {
  provider: string;
  url: string;
  symbols: string[];
  enabled?: boolean;
  weight?: number;
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function loadNewsRssFeeds(env: NodeJS.ProcessEnv = process.env): NewsRssFeedConfig[] {
  const raw = env.NEWS_RSS_FEEDS_JSON?.trim();
  if (!raw) return [];

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("NEWS_RSS_FEEDS_JSON must be a JSON array");
  }

  return parsed
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`NEWS_RSS_FEEDS_JSON[${index}] must be an object`);
      }

      const obj = item as Record<string, unknown>;
      const provider = typeof obj.provider === "string" ? obj.provider.trim() : "";
      const url = typeof obj.url === "string" ? obj.url.trim() : "";
      const symbols =
        Array.isArray(obj.symbols) && obj.symbols.every((s) => typeof s === "string")
          ? (obj.symbols as string[]).map(normalizeSymbol).filter(Boolean)
          : [];
      const enabled = obj.enabled === undefined ? true : Boolean(obj.enabled);
      const weight =
        typeof obj.weight === "number" && Number.isFinite(obj.weight) ? obj.weight : 100;

      if (!provider) throw new Error(`NEWS_RSS_FEEDS_JSON[${index}].provider is required`);
      if (!url) throw new Error(`NEWS_RSS_FEEDS_JSON[${index}].url is required`);
      if (symbols.length === 0)
        throw new Error(`NEWS_RSS_FEEDS_JSON[${index}].symbols is required`);

      return { provider, url, symbols, enabled, weight } satisfies NewsRssFeedConfig;
    })
    .filter((feed) => feed.enabled !== false);
}

export function getNewsScheduleEverySeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.NEWS_SCHEDULE_EVERY_SECONDS?.trim();
  if (!raw) return 1800;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 1800;
  return Math.floor(value);
}
