import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

export type ParsedNewsItem = {
  title: string;
  url: string;
  urlHash: Uint8Array<ArrayBuffer>;
  publishedAt: Date;
  publisher?: string;
  externalId?: string;
  raw: Record<string, unknown>;
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
]);

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseDate(value: unknown): Date | null {
  const raw = toStringOrNull(value);
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function canonicalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    const entries = Array.from(parsed.searchParams.entries()).sort((a, b) => {
      if (a[0] === b[0]) return a[1].localeCompare(b[1]);
      return a[0].localeCompare(b[0]);
    });

    parsed.search = "";
    for (const [key, value] of entries) {
      parsed.searchParams.append(key, value);
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function sha256Bytes(value: string): Uint8Array<ArrayBuffer> {
  return crypto.createHash("sha256").update(value).digest() as unknown as Uint8Array<ArrayBuffer>;
}

function objectToRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const text = obj["#text"];
  if (typeof text === "string") return text.trim() || null;
  return null;
}

function pickLink(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const link = pickLink(item);
      if (link) return link;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  const href = toStringOrNull(obj["@_href"]);
  if (href) return href;
  return pickText(value);
}

function parseRssItems(channel: unknown): Array<Record<string, unknown>> {
  const obj = objectToRecord(channel);
  const items = obj.item;
  if (!items) return [];
  if (Array.isArray(items)) return items.map(objectToRecord);
  return [objectToRecord(items)];
}

function parseAtomEntries(feed: unknown): Array<Record<string, unknown>> {
  const obj = objectToRecord(feed);
  const entries = obj.entry;
  if (!entries) return [];
  if (Array.isArray(entries)) return entries.map(objectToRecord);
  return [objectToRecord(entries)];
}

export function parseRssOrAtom(xml: string): ParsedNewsItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
  });

  const parsed = parser.parse(xml) as unknown;
  const doc = objectToRecord(parsed);

  const out: ParsedNewsItem[] = [];

  const rssChannel = doc.rss ? objectToRecord(objectToRecord(doc.rss).channel) : null;
  if (rssChannel) {
    for (const item of parseRssItems(rssChannel)) {
      const title = pickText(item.title) ?? toStringOrNull(item.title) ?? "";
      const link = pickLink(item.link) ?? "";
      const publishedAt =
        parseDate(item.pubDate) ?? parseDate(item.published) ?? parseDate(item.updated);
      if (!title || !link || !publishedAt) continue;

      const canonical = canonicalizeUrl(link);
      out.push({
        title,
        url: canonical,
        urlHash: sha256Bytes(canonical),
        publishedAt,
        publisher: pickText(item.source) ?? toStringOrNull(item.source) ?? undefined,
        externalId: pickText(item.guid) ?? toStringOrNull(item.guid) ?? undefined,
        raw: item,
      });
    }
    return out;
  }

  const atomFeed = doc.feed ? objectToRecord(doc.feed) : null;
  if (atomFeed) {
    for (const entry of parseAtomEntries(atomFeed)) {
      const title = pickText(entry.title) ?? toStringOrNull(entry.title) ?? "";
      const link = pickLink(entry.link) ?? "";
      const publishedAt = parseDate(entry.published) ?? parseDate(entry.updated);
      if (!title || !link || !publishedAt) continue;

      const canonical = canonicalizeUrl(link);
      const author = objectToRecord(entry.author);
      const publisher = pickText(author.name) ?? pickText(entry.source) ?? undefined;

      out.push({
        title,
        url: canonical,
        urlHash: sha256Bytes(canonical),
        publishedAt,
        publisher,
        externalId: pickText(entry.id) ?? toStringOrNull(entry.id) ?? undefined,
        raw: entry,
      });
    }
  }

  return out;
}
