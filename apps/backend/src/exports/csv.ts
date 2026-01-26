import type { PrismaClient } from "@prisma/client";
import { convertMinorAmount, createEnvFxRateProvider } from "../analytics/fx";
import type { ExportType } from "./types";

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function formatMinorToMajor(amountMinor: bigint): string {
  const sign = amountMinor < 0n ? "-" : "";
  const abs = absBigInt(amountMinor);
  const major = abs / 100n;
  const cents = abs % 100n;
  return `${sign}${major.toString()}.${cents.toString().padStart(2, "0")}`;
}

function escapeCsvCell(raw: string): string {
  if (!raw) return "";
  const needsQuotes = /[",\n\r]/.test(raw);
  if (!needsQuotes) return raw;
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function csvLine(cells: Array<string | number>): string {
  return cells.map((c) => escapeCsvCell(String(c))).join(",");
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function classifyOptionDirection(typeRaw: string): "buy" | "sell" | null {
  const t = typeRaw.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("sell") || t.includes("sto")) return "sell";
  if (t.includes("buy") || t.includes("bto")) return "buy";
  return null;
}

function parseYearFilter(params: unknown): number | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const obj = params as Record<string, unknown>;
  const raw = obj.year;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const year = Math.trunc(n);
  if (year < 1900 || year > 2100) return null;
  return year;
}

export async function generateExportCsv(input: {
  prisma: PrismaClient;
  userId: string;
  type: ExportType;
  params?: unknown;
}): Promise<{ filename: string; contentType: string; body: Buffer }> {
  const preferences = await input.prisma.userPreferences.findUnique({ where: { userId: input.userId } });
  const baseCurrency = normalizeCurrency(preferences?.baseCurrency ?? "USD");
  const today = new Date().toISOString().slice(0, 10);

  if (input.type === "user_data") {
    throw new Error("Unsupported export type for CSV: user_data");
  }

  if (input.type === "pnl_realized_by_ticker") {
    const rows = await input.prisma.tickerPnlTotal.findMany({
      where: { userId: input.userId, baseCurrency },
      orderBy: { symbol: "asc" },
      take: 10_000,
    });

    const lines: string[] = [];
    lines.push(csvLine(["symbol", "realized_pnl", "base_currency", "last_recomputed_at"]));
    for (const row of rows) {
      lines.push(
        csvLine([
          row.symbol,
          formatMinorToMajor(row.realizedPnlMinor),
          row.baseCurrency,
          row.lastRecomputedAt.toISOString(),
        ]),
      );
    }

    const body = Buffer.from(lines.join("\n") + "\n", "utf8");
    return {
      filename: `realized_by_ticker_${today}.csv`,
      contentType: "text/csv; charset=utf-8",
      body,
    };
  }

  if (input.type === "option_premiums_by_year") {
    const yearFilter = parseYearFilter(input.params);
    const fx = createEnvFxRateProvider();
    const txs = await input.prisma.transaction.findMany({
      where: { userId: input.userId },
      include: {
        instrument: true,
        optionContract: { include: { underlyingInstrument: true } },
      },
      orderBy: [{ executedAt: "asc" }, { id: "asc" }],
      take: 100_000,
    });

    const byYear = new Map<number, { netPremiumMinor: bigint; count: number; fxMissing: number }>();

    for (const tx of txs) {
      const year = tx.executedAt.getUTCFullYear();
      if (yearFilter && year !== yearFilter) continue;

      if (!tx.optionContractId && !tx.type.toLowerCase().includes("option") && !tx.type.toLowerCase().includes("call") && !tx.type.toLowerCase().includes("put")) {
        continue;
      }

      const dir = classifyOptionDirection(tx.type);
      if (!dir) continue;

      if (tx.grossAmountMinor === null) continue;

      const acc = byYear.get(year) ?? { netPremiumMinor: 0n, count: 0, fxMissing: 0 };
      byYear.set(year, acc);

      const inferredCurrency =
        tx.priceCurrency ??
        tx.instrument?.currency ??
        tx.optionContract?.underlyingInstrument?.currency ??
        baseCurrency;
      const fromCurrency = normalizeCurrency(inferredCurrency ?? baseCurrency);
      const converted = convertMinorAmount({
        amountMinor: absBigInt(tx.grossAmountMinor),
        fromCurrency,
        toCurrency: baseCurrency,
        asOf: tx.executedAt,
        fx,
      });
      if (!converted.ok) {
        acc.fxMissing += 1;
        continue;
      }

      const delta = dir === "sell" ? absBigInt(converted.amountMinor) : -absBigInt(converted.amountMinor);
      acc.netPremiumMinor += delta;
      acc.count += 1;
    }

    const years = Array.from(byYear.keys()).sort((a, b) => a - b);
    const lines: string[] = [];
    lines.push(csvLine(["year", "net_option_premiums", "base_currency", "trades_count", "fx_missing"]));
    for (const year of years) {
      const row = byYear.get(year);
      if (!row) continue;
      lines.push(
        csvLine([
          year,
          formatMinorToMajor(row.netPremiumMinor),
          baseCurrency,
          row.count,
          row.fxMissing,
        ]),
      );
    }

    const body = Buffer.from(lines.join("\n") + "\n", "utf8");
    return {
      filename: yearFilter ? `option_premiums_${yearFilter}.csv` : `option_premiums_by_year_${today}.csv`,
      contentType: "text/csv; charset=utf-8",
      body,
    };
  }

  const exhaustive: never = input.type;
  throw new Error(`Unsupported export type: ${exhaustive}`);
}
