import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEnvFxRateProvider } from "./fx";
import {
  computeTickerPnl360,
  type PnlPositionSnapshotInput,
  type PnlTransactionInput,
} from "./pnl";

type PnlFixtureTx = {
  id: string;
  executedAt: string;
  type: string;
  quantity?: string | null;
  priceAmountMinor?: string | null;
  priceCurrency?: string | null;
  grossAmountMinor?: string | null;
  feesAmountMinor?: string | null;
  feesCurrency?: string | null;
  instrument?: { symbol: string | null; currency: string } | null;
  optionContract?: {
    currency: string;
    right?: string | null;
    multiplier?: number | null;
    underlyingInstrument: { symbol: string | null };
  } | null;
  raw?: unknown | null;
};

type PnlFixtureSnapshot = {
  instrument: { symbol: string | null; currency: string };
  asOf: string;
  marketValueAmountMinor?: string | null;
  marketValueCurrency?: string | null;
  unrealizedPnlAmountMinor?: string | null;
  unrealizedPnlCurrency?: string | null;
};

type PnlFixture = {
  id: string;
  description?: string;
  input: {
    userId: string;
    baseCurrency: string;
    asOf: string;
    fxRates?: Record<string, unknown>;
    transactions: PnlFixtureTx[];
    positionSnapshots: PnlFixtureSnapshot[];
  };
  expected: {
    totals: Array<{
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
    daily: Array<{
      symbol: string;
      baseCurrency: string;
      date: string;
      netPnlMinor: string;
      marketValueMinor: string;
      realizedPnlMinor: string;
      unrealizedPnlMinor: string;
    }>;
    anomalies: string[];
  };
};

function parseIsoDate(value: string): Date {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
  return d;
}

function parseBigint(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim()) return BigInt(value);
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  throw new Error(`Invalid bigint: ${JSON.stringify(value)}`);
}

function txFromFixture(f: PnlFixtureTx): PnlTransactionInput {
  return {
    id: f.id,
    executedAt: parseIsoDate(f.executedAt),
    type: f.type,
    quantity: f.quantity ?? null,
    priceAmountMinor: parseBigint(f.priceAmountMinor),
    priceCurrency: f.priceCurrency ?? null,
    grossAmountMinor: parseBigint(f.grossAmountMinor),
    feesAmountMinor: parseBigint(f.feesAmountMinor),
    feesCurrency: f.feesCurrency ?? null,
    instrument: f.instrument ?? null,
    optionContract: f.optionContract ?? null,
    raw: f.raw ?? null,
  };
}

function snapshotFromFixture(f: PnlFixtureSnapshot): PnlPositionSnapshotInput {
  return {
    instrument: f.instrument,
    asOf: parseIsoDate(f.asOf),
    marketValueAmountMinor: parseBigint(f.marketValueAmountMinor),
    marketValueCurrency: f.marketValueCurrency ?? null,
    unrealizedPnlAmountMinor: parseBigint(f.unrealizedPnlAmountMinor),
    unrealizedPnlCurrency: f.unrealizedPnlCurrency ?? null,
  };
}

function serializePnlResult(result: ReturnType<typeof computeTickerPnl360>): PnlFixture["expected"] {
  return {
    totals: result.totals.map((row) => ({
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
    daily: result.daily.map((row) => ({
      symbol: row.symbol,
      baseCurrency: row.baseCurrency,
      date: row.date.toISOString().slice(0, 10),
      netPnlMinor: row.netPnlMinor.toString(),
      marketValueMinor: row.marketValueMinor.toString(),
      realizedPnlMinor: row.realizedPnlMinor.toString(),
      unrealizedPnlMinor: row.unrealizedPnlMinor.toString(),
    })),
    anomalies: result.anomalies,
  };
}

function loadFixtures(): PnlFixture[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(here, "__fixtures__", "pnl");

  const entries = fs
    .readdirSync(fixturesDir, { withFileTypes: true })
    .filter((ent) => ent.isFile() && ent.name.endsWith(".json"))
    .map((ent) => ent.name)
    .sort((a, b) => a.localeCompare(b));

  return entries.map((name) => {
    const raw = fs.readFileSync(path.join(fixturesDir, name), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed as PnlFixture;
  });
}

describe("QA-002: P&L 360 fixtures (golden files)", () => {
  const fixtures = loadFixtures();

  it("has fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    it(fixture.id, () => {
      const fxRates = fixture.input.fxRates ?? {};
      const fx = createEnvFxRateProvider({
        FX_RATES_JSON: JSON.stringify(fxRates),
      });

      const result = computeTickerPnl360({
        userId: fixture.input.userId,
        baseCurrency: fixture.input.baseCurrency,
        asOf: parseIsoDate(fixture.input.asOf),
        transactions: fixture.input.transactions.map(txFromFixture),
        positionSnapshots: fixture.input.positionSnapshots.map(snapshotFromFixture),
        fx,
      });

      expect(serializePnlResult(result)).toEqual(fixture.expected);
    });
  }
});
