import { describe, expect, it } from "vitest";
import { parseRssOrAtom } from "./rss";

describe("parseRssOrAtom", () => {
  it("parses RSS items", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example</title>
          <item>
            <title>Apple news</title>
            <link>https://example.com/a?utm_source=x&amp;b=2&amp;a=1#frag</link>
            <pubDate>Mon, 01 Jan 2026 10:00:00 GMT</pubDate>
            <source>Example Publisher</source>
            <guid>guid-1</guid>
          </item>
        </channel>
      </rss>`;

    const items = parseRssOrAtom(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Apple news");
    expect(items[0]?.url).toBe("https://example.com/a?a=1&b=2");
    expect(items[0]?.publisher).toBe("Example Publisher");
    expect(items[0]?.externalId).toBe("guid-1");
    expect(items[0]?.publishedAt.toISOString()).toBe("2026-01-01T10:00:00.000Z");
  });

  it("parses Atom entries", () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Example</title>
        <entry>
          <title>Tesla update</title>
          <id>tag:example.com,2026:1</id>
          <updated>2026-01-02T00:00:00Z</updated>
          <link href="https://example.com/tsla?utm_campaign=y#frag" />
          <author><name>Atom Publisher</name></author>
        </entry>
      </feed>`;

    const items = parseRssOrAtom(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Tesla update");
    expect(items[0]?.url).toBe("https://example.com/tsla");
    expect(items[0]?.publisher).toBe("Atom Publisher");
    expect(items[0]?.externalId).toBe("tag:example.com,2026:1");
    expect(items[0]?.publishedAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

