import { describe, expect, it } from "vitest";
import { FX_RATE_SCALE, type FxRateProvider } from "./fx";
import {
  computeTickerPnl360,
  type PnlPositionSnapshotInput,
  type PnlTransactionInput,
} from "./pnl";

function fxFromMap(rates: Record<string, number>): FxRateProvider {
  const map = new Map<string, bigint>();
  for (const [pair, rate] of Object.entries(rates)) {
    map.set(pair.toUpperCase(), BigInt(Math.round(rate * Number(FX_RATE_SCALE))));
  }

  return {
    getRateScaled: ({ from, to }) => {
      const fromNorm = from.trim().toUpperCase();
      const toNorm = to.trim().toUpperCase();
      if (fromNorm === toNorm) return FX_RATE_SCALE;
      const direct = map.get(`${fromNorm}_${toNorm}`) ?? map.get(`${fromNorm}${toNorm}`);
      if (direct) return direct;
      const inverse = map.get(`${toNorm}_${fromNorm}`) ?? map.get(`${toNorm}${fromNorm}`);
      if (!inverse) return null;
      return (FX_RATE_SCALE * FX_RATE_SCALE) / inverse;
    },
  };
}

function tx(
  partial: Partial<PnlTransactionInput> & Pick<PnlTransactionInput, "id" | "executedAt" | "type">,
): PnlTransactionInput {
  return {
    id: partial.id,
    executedAt: partial.executedAt,
    type: partial.type,
    quantity: partial.quantity ?? null,
    priceAmountMinor: partial.priceAmountMinor ?? null,
    priceCurrency: partial.priceCurrency ?? null,
    grossAmountMinor: partial.grossAmountMinor ?? null,
    feesAmountMinor: partial.feesAmountMinor ?? null,
    feesCurrency: partial.feesCurrency ?? null,
    instrument: partial.instrument ?? null,
    optionContract: partial.optionContract ?? null,
    raw: partial.raw ?? null,
  };
}

describe("computeTickerPnl360", () => {
  it("computes realized/unrealized, premiums, dividends, fees (cumulative daily)", () => {
    const asOf = new Date("2026-01-03T12:00:00Z");
    const fx = fxFromMap({});

    const transactions: PnlTransactionInput[] = [
      tx({
        id: "t1",
        executedAt: new Date("2026-01-01T10:00:00Z"),
        type: "buy",
        quantity: "10",
        priceCurrency: "USD",
        grossAmountMinor: 100_000n,
        feesAmountMinor: 100n,
        feesCurrency: "USD",
        instrument: { symbol: "AAPL", currency: "USD" },
      }),
      tx({
        id: "t2",
        executedAt: new Date("2026-01-02T10:00:00Z"),
        type: "sell",
        quantity: "5",
        priceCurrency: "USD",
        grossAmountMinor: 60_000n,
        feesAmountMinor: 100n,
        feesCurrency: "USD",
        instrument: { symbol: "AAPL", currency: "USD" },
      }),
      tx({
        id: "t3",
        executedAt: new Date("2026-01-02T11:00:00Z"),
        type: "option_sell_to_open",
        quantity: "1",
        priceCurrency: "USD",
        grossAmountMinor: 20_000n,
        feesAmountMinor: 50n,
        feesCurrency: "USD",
        optionContract: {
          currency: "USD",
          underlyingInstrument: { symbol: "AAPL" },
          right: "call",
          multiplier: 100,
        },
      }),
      tx({
        id: "t4",
        executedAt: new Date("2026-01-02T12:00:00Z"),
        type: "dividend",
        grossAmountMinor: 5_000n,
        priceCurrency: "USD",
        instrument: { symbol: "AAPL", currency: "USD" },
      }),
    ];

    const snapshots: PnlPositionSnapshotInput[] = [
      {
        instrument: { symbol: "AAPL", currency: "USD" },
        asOf,
        marketValueAmountMinor: 65_000n,
        marketValueCurrency: "USD",
        unrealizedPnlAmountMinor: 15_000n,
        unrealizedPnlCurrency: "USD",
      },
    ];

    const result = computeTickerPnl360({
      userId: "u1",
      baseCurrency: "USD",
      asOf,
      transactions,
      positionSnapshots: snapshots,
      fx,
    });

    expect(result.anomalies).toEqual([]);
    expect(result.totals).toEqual([
      {
        symbol: "AAPL",
        baseCurrency: "USD",
        realizedPnlMinor: 10_000n,
        unrealizedPnlMinor: 15_000n,
        optionPremiumsMinor: 20_000n,
        dividendsMinor: 5_000n,
        feesMinor: 250n,
        netPnlMinor: 49_750n,
        lastRecomputedAt: asOf,
      },
    ]);

    const aaplDaily = result.daily.filter((row) => row.symbol === "AAPL");
    expect(aaplDaily).toEqual([
      {
        symbol: "AAPL",
        baseCurrency: "USD",
        date: new Date("2026-01-01"),
        netPnlMinor: -100n,
        marketValueMinor: 0n,
        realizedPnlMinor: 0n,
        unrealizedPnlMinor: 0n,
      },
      {
        symbol: "AAPL",
        baseCurrency: "USD",
        date: new Date("2026-01-02"),
        netPnlMinor: 34_750n,
        marketValueMinor: 0n,
        realizedPnlMinor: 10_000n,
        unrealizedPnlMinor: 0n,
      },
      {
        symbol: "AAPL",
        baseCurrency: "USD",
        date: new Date("2026-01-03"),
        netPnlMinor: 49_750n,
        marketValueMinor: 65_000n,
        realizedPnlMinor: 10_000n,
        unrealizedPnlMinor: 15_000n,
      },
    ]);
  });

  it("converts amounts to base currency using FX rates", () => {
    const asOf = new Date("2026-01-03T12:00:00Z");
    const fx = fxFromMap({ CAD_USD: 0.75 });

    const transactions: PnlTransactionInput[] = [
      tx({
        id: "t1",
        executedAt: new Date("2026-01-01T10:00:00Z"),
        type: "dividend",
        grossAmountMinor: 10_000n,
        priceCurrency: "CAD",
        instrument: { symbol: "SHOP", currency: "CAD" },
      }),
    ];

    const result = computeTickerPnl360({
      userId: "u1",
      baseCurrency: "USD",
      asOf,
      transactions,
      positionSnapshots: [],
      fx,
    });

    expect(result.totals[0]?.dividendsMinor).toBe(7_500n);
    expect(result.totals[0]?.netPnlMinor).toBe(7_500n);
  });
});
