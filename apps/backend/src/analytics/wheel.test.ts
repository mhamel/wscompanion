import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectWheelCycles, type WheelCycleDraft, type WheelTransactionInput } from "./wheel";

type WheelFixtureTx = {
  id: string;
  executedAt: string;
  type: string;
  optionContract?: { right: string | null } | null;
  raw?: unknown | null;
};

type WheelFixture = {
  id: string;
  description?: string;
  input: {
    symbol: string;
    transactions: WheelFixtureTx[];
  };
  expected: Array<{
    symbol: string;
    status: "open" | "closed";
    openedAt: string;
    closedAt: string | null;
    legs: Array<{
      kind: string;
      occurredAt: string;
      transactionId: string | null;
      raw: unknown | null;
    }>;
  }>;
};

function parseIsoDate(value: string): Date {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
  return d;
}

function txFromFixture(f: WheelFixtureTx): WheelTransactionInput {
  return {
    id: f.id,
    executedAt: parseIsoDate(f.executedAt),
    type: f.type,
    optionContract: f.optionContract ?? null,
    raw: f.raw ?? null,
  };
}

function serializeCycles(cycles: WheelCycleDraft[]): WheelFixture["expected"] {
  return cycles.map((cycle) => ({
    symbol: cycle.symbol,
    status: cycle.status,
    openedAt: cycle.openedAt.toISOString(),
    closedAt: cycle.closedAt ? cycle.closedAt.toISOString() : null,
    legs: cycle.legs.map((leg) => ({
      kind: leg.kind,
      occurredAt: leg.occurredAt.toISOString(),
      transactionId: leg.transactionId,
      raw: (leg.raw ?? null) as unknown | null,
    })),
  }));
}

function loadFixtures(): WheelFixture[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(here, "__fixtures__", "wheel");

  const entries = fs
    .readdirSync(fixturesDir, { withFileTypes: true })
    .filter((ent) => ent.isFile() && ent.name.endsWith(".json"))
    .map((ent) => ent.name)
    .sort((a, b) => a.localeCompare(b));

  return entries.map((name) => {
    const raw = fs.readFileSync(path.join(fixturesDir, name), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed as WheelFixture;
  });
}

describe("QA-002: wheel detection fixtures (golden files)", () => {
  const fixtures = loadFixtures();

  it("has fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    it(fixture.id, () => {
      const cycles = detectWheelCycles({
        symbol: fixture.input.symbol,
        transactions: fixture.input.transactions.map(txFromFixture),
      });

      expect(serializeCycles(cycles)).toEqual(fixture.expected);
    });
  }
});
