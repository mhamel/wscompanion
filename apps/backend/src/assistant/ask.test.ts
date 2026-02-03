import { describe, expect, it } from "vitest";
import { buildAskResponse } from "./ask";
import type { TickerPnlTotal } from "@prisma/client";

describe("ask", () => {
  it("builds a structured response with pnl + sources", () => {
    const res = buildAskResponse({
      question: "Why did AAPL drop?",
      symbol: "AAPL",
      baseCurrency: "USD",
      pnlTotal: {
        userId: "u",
        symbol: "AAPL",
        baseCurrency: "USD",
        realizedPnlMinor: 100n,
        unrealizedPnlMinor: -200n,
        optionPremiumsMinor: 300n,
        dividendsMinor: 0n,
        feesMinor: -10n,
        netPnlMinor: 190n,
        lastRecomputedAt: new Date("2026-02-03T00:00:00Z"),
      } as unknown as TickerPnlTotal,
      transactionsSince: new Date("2026-01-01T00:00:00Z"),
      transactionsCount: 12,
      news: [
        {
          url: "https://example.com/a",
          title: "AAPL headline",
          publisher: "Example",
          publishedAt: new Date("2026-02-01T00:00:00Z"),
        },
      ],
    });

    expect(res.answer).toContain("AAPL");
    expect(res.sections.length).toBeGreaterThan(0);
    expect(res.sections[0].sources.length).toBeGreaterThan(0);
  });
});
