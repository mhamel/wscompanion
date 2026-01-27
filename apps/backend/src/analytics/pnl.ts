import { convertMinorAmount, createEnvFxRateProvider, type FxRateProvider } from "./fx";

const QUANTITY_SCALE = 10n ** 10n;

type DecimalLike = { toString: () => string };

export type PnlTransactionInput = {
  id: string;
  executedAt: Date;
  type: string;
  quantity: DecimalLike | string | null;
  priceAmountMinor: bigint | null;
  priceCurrency: string | null;
  grossAmountMinor: bigint | null;
  feesAmountMinor: bigint | null;
  feesCurrency: string | null;
  instrument: {
    symbol: string | null;
    currency: string;
  } | null;
  optionContract: {
    currency: string;
    right?: string | null;
    multiplier?: number | null;
    underlyingInstrument: { symbol: string | null };
  } | null;
  raw: unknown | null;
};

export type PnlPositionSnapshotInput = {
  instrument: { symbol: string | null; currency: string };
  asOf: Date;
  marketValueAmountMinor: bigint | null;
  marketValueCurrency: string | null;
  unrealizedPnlAmountMinor: bigint | null;
  unrealizedPnlCurrency: string | null;
};

export type TickerPnlTotalRow = {
  symbol: string;
  baseCurrency: string;
  realizedPnlMinor: bigint;
  unrealizedPnlMinor: bigint;
  optionPremiumsMinor: bigint;
  dividendsMinor: bigint;
  feesMinor: bigint;
  netPnlMinor: bigint;
  lastRecomputedAt: Date;
};

export type TickerPnlDailyRow = {
  symbol: string;
  baseCurrency: string;
  date: Date;
  netPnlMinor: bigint;
  marketValueMinor: bigint;
  realizedPnlMinor: bigint;
  unrealizedPnlMinor: bigint;
};

type PnlAccumulator = {
  realized: bigint;
  unrealized: bigint;
  marketValue: bigint;
  optionPremiums: bigint;
  dividends: bigint;
  fees: bigint;
};

type DailyAccumulator = PnlAccumulator;

type PnlLot = { quantityMinor: bigint; totalCostMinor: bigint };

type PnlKind =
  | "stock_buy"
  | "stock_sell"
  | "option_buy"
  | "option_sell"
  | "dividend"
  | "fee"
  | "unknown";

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDecimalToQuantityMinor(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;

  const sign = match[1] ? -1n : 1n;
  const intPart = match[2];
  const fracPart = match[3] ?? "";

  const fracDigits = fracPart.replace(/_/g, "");
  const fracPadded = (fracDigits + "0".repeat(10)).slice(0, 10);
  const extraDigit = fracDigits.length > 10 ? fracDigits[10] : "0";

  let minor = BigInt(intPart) * QUANTITY_SCALE + BigInt(fracPadded);
  if (extraDigit >= "5") {
    minor += 1n;
  }

  return minor * sign;
}

function parseQuantityMinor(value: DecimalLike | string | null): bigint | null {
  if (!value) return null;
  const asString = typeof value === "string" ? value : value.toString();
  return parseDecimalToQuantityMinor(asString);
}

function mulDivRound(numerator: bigint, divisor: bigint): bigint {
  if (divisor === 0n) throw new Error("Division by zero");
  const sign = numerator < 0n ? -1n : 1n;
  const absNumerator = absBigInt(numerator);
  const absDivisor = absBigInt(divisor);
  const half = absDivisor / 2n;
  const rounded = (absNumerator + half) / absDivisor;
  return rounded * sign;
}

function takePortion(total: bigint, partQty: bigint, totalQty: bigint): bigint {
  if (totalQty === 0n) return 0n;
  return mulDivRound(total * partQty, totalQty);
}

function getStringField(raw: unknown, keys: string[]): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function getNumberField(raw: unknown, keys: string[]): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function deriveSymbol(tx: PnlTransactionInput): string | null {
  const direct =
    tx.instrument?.symbol ?? tx.optionContract?.underlyingInstrument?.symbol ?? undefined;
  if (direct && direct.trim()) return normalizeSymbol(direct);

  const rawSymbol = getStringField(tx.raw, [
    "symbol",
    "ticker",
    "underlyingSymbol",
    "underlying_symbol",
    "occUnderlyingSymbol",
  ]);
  if (rawSymbol) return normalizeSymbol(rawSymbol);

  const instrument = getStringField(tx.raw, ["instrumentSymbol", "instrument_symbol"]);
  if (instrument) return normalizeSymbol(instrument);

  return null;
}

function deriveGrossCurrency(tx: PnlTransactionInput, baseCurrency: string): string {
  const inferred =
    tx.priceCurrency ??
    tx.instrument?.currency ??
    tx.optionContract?.currency ??
    getStringField(tx.raw, ["currency"]) ??
    baseCurrency;
  return normalizeCurrency(inferred);
}

function deriveFeesCurrency(tx: PnlTransactionInput, grossCurrency: string): string {
  const inferred = tx.feesCurrency ?? getStringField(tx.raw, ["feesCurrency", "fees_currency"]);
  return normalizeCurrency(inferred ?? grossCurrency);
}

function deriveGrossMinor(tx: PnlTransactionInput): bigint | null {
  if (tx.grossAmountMinor !== null) return absBigInt(tx.grossAmountMinor);

  const qtyMinor = parseQuantityMinor(tx.quantity);
  if (qtyMinor === null) return null;

  if (tx.priceAmountMinor !== null) {
    const total = mulDivRound(tx.priceAmountMinor * absBigInt(qtyMinor), QUANTITY_SCALE);
    return absBigInt(total);
  }

  const rawGross = getNumberField(tx.raw, ["grossAmountMinor", "gross_amount_minor"]);
  if (rawGross !== null) return absBigInt(BigInt(Math.trunc(rawGross)));

  return null;
}

function deriveFeesMinor(tx: PnlTransactionInput): bigint | null {
  if (tx.feesAmountMinor !== null) return absBigInt(tx.feesAmountMinor);

  const rawFees = getNumberField(tx.raw, ["feesAmountMinor", "fees_amount_minor"]);
  if (rawFees !== null) return absBigInt(BigInt(Math.trunc(rawFees)));

  return null;
}

function classifyTransaction(tx: PnlTransactionInput): PnlKind {
  const type = tx.type.trim().toLowerCase();
  if (!type) return "unknown";

  if (type.includes("assigned") || type.includes("assignment") || type.includes("exercise")) {
    const rightRaw =
      tx.optionContract?.right ??
      getStringField(tx.raw, ["right", "optionRight", "option_right", "optionType"]);
    const right = rightRaw ? rightRaw.trim().toLowerCase() : "";
    if (right.startsWith("p")) return "stock_buy";
    if (right.startsWith("c")) return "stock_sell";
    return "unknown";
  }

  if (type.includes("dividend")) return "dividend";
  if (type.includes("fee") || type.includes("commission")) return "fee";

  const isOption =
    Boolean(tx.optionContract) ||
    type.includes("option") ||
    type.includes("call") ||
    type.includes("put");
  if (isOption) {
    if (type.includes("sell") || type.includes("sto")) return "option_sell";
    if (type.includes("buy") || type.includes("bto")) return "option_buy";
    return "unknown";
  }

  if (type.includes("buy")) return "stock_buy";
  if (type.includes("sell")) return "stock_sell";

  return "unknown";
}

function parseExplicitFxRateScaled(
  raw: unknown,
): { from: string; to: string; rate: number } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const fxObj = obj.fx;
  if (fxObj && typeof fxObj === "object" && !Array.isArray(fxObj)) {
    const fx = fxObj as Record<string, unknown>;
    const from = typeof fx.fromCurrency === "string" ? fx.fromCurrency : "";
    const to = typeof fx.toCurrency === "string" ? fx.toCurrency : "";
    const rate =
      typeof fx.rate === "number" ? fx.rate : typeof fx.rate === "string" ? Number(fx.rate) : NaN;
    if (from && to && Number.isFinite(rate) && rate > 0) {
      return { from, to, rate };
    }
  }

  const from = typeof obj.fxFromCurrency === "string" ? obj.fxFromCurrency : "";
  const to = typeof obj.fxToCurrency === "string" ? obj.fxToCurrency : "";
  const rate =
    typeof obj.fxRate === "number"
      ? obj.fxRate
      : typeof obj.fxRate === "string"
        ? Number(obj.fxRate)
        : NaN;
  if (from && to && Number.isFinite(rate) && rate > 0) return { from, to, rate };

  return null;
}

function getFxProviderWithRawOverrides(base: FxRateProvider): FxRateProvider {
  return {
    getRateScaled: ({ from, to, asOf }) => base.getRateScaled({ from, to, asOf }),
  };
}

function createDefaultFxProvider(): FxRateProvider {
  return getFxProviderWithRawOverrides(createEnvFxRateProvider());
}

function ensureAccumulator(map: Map<string, PnlAccumulator>, symbol: string): PnlAccumulator {
  const existing = map.get(symbol);
  if (existing) return existing;
  const fresh: PnlAccumulator = {
    realized: 0n,
    unrealized: 0n,
    marketValue: 0n,
    optionPremiums: 0n,
    dividends: 0n,
    fees: 0n,
  };
  map.set(symbol, fresh);
  return fresh;
}

function ensureDailyAccumulator(map: Map<string, DailyAccumulator>, key: string): DailyAccumulator {
  const existing = map.get(key);
  if (existing) return existing;
  const fresh: DailyAccumulator = {
    realized: 0n,
    unrealized: 0n,
    marketValue: 0n,
    optionPremiums: 0n,
    dividends: 0n,
    fees: 0n,
  };
  map.set(key, fresh);
  return fresh;
}

function applyFees(totals: PnlAccumulator, daily: DailyAccumulator, feeMinorBase: bigint) {
  if (feeMinorBase === 0n) return;
  totals.fees += feeMinorBase;
  daily.fees += feeMinorBase;
}

function applyOptionPremium(
  totals: PnlAccumulator,
  daily: DailyAccumulator,
  premiumMinorBase: bigint,
  direction: "sell" | "buy",
) {
  if (premiumMinorBase === 0n) return;
  const delta = direction === "sell" ? premiumMinorBase : -premiumMinorBase;
  totals.optionPremiums += delta;
  daily.optionPremiums += delta;
}

function applyDividend(totals: PnlAccumulator, daily: DailyAccumulator, amountMinorBase: bigint) {
  if (amountMinorBase === 0n) return;
  totals.dividends += amountMinorBase;
  daily.dividends += amountMinorBase;
}

function applyRealized(totals: PnlAccumulator, daily: DailyAccumulator, amountMinorBase: bigint) {
  if (amountMinorBase === 0n) return;
  totals.realized += amountMinorBase;
  daily.realized += amountMinorBase;
}

function processStockBuy(input: {
  lots: PnlLot[];
  qtyMinor: bigint;
  costMinor: bigint;
  totals: PnlAccumulator;
  daily: DailyAccumulator;
}) {
  let remainingQty = input.qtyMinor;
  let remainingCost = input.costMinor;

  while (remainingQty > 0n && input.lots.length > 0) {
    const first = input.lots[0];
    if (first.quantityMinor >= 0n) break; // only cover shorts here

    const shortQtyAbs = absBigInt(first.quantityMinor);
    const coverQty = minBigInt(remainingQty, shortQtyAbs);

    const proceedsPortion = takePortion(first.totalCostMinor, coverQty, shortQtyAbs);
    const coverCostPortion = takePortion(remainingCost, coverQty, remainingQty);
    applyRealized(input.totals, input.daily, proceedsPortion - coverCostPortion);

    first.quantityMinor += coverQty;
    first.totalCostMinor -= proceedsPortion;

    remainingQty -= coverQty;
    remainingCost -= coverCostPortion;

    if (first.quantityMinor === 0n) {
      input.lots.shift();
    }
  }

  if (remainingQty > 0n) {
    input.lots.push({ quantityMinor: remainingQty, totalCostMinor: remainingCost });
  }
}

function processStockSell(input: {
  lots: PnlLot[];
  qtyMinor: bigint;
  proceedsMinor: bigint;
  totals: PnlAccumulator;
  daily: DailyAccumulator;
}) {
  let remainingQty = input.qtyMinor;
  let remainingProceeds = input.proceedsMinor;

  while (remainingQty > 0n && input.lots.length > 0) {
    const first = input.lots[0];
    if (first.quantityMinor <= 0n) break; // only close longs here

    const closeQty = minBigInt(remainingQty, first.quantityMinor);

    const costPortion = takePortion(first.totalCostMinor, closeQty, first.quantityMinor);
    const proceedsPortion = takePortion(remainingProceeds, closeQty, remainingQty);
    applyRealized(input.totals, input.daily, proceedsPortion - costPortion);

    first.quantityMinor -= closeQty;
    first.totalCostMinor -= costPortion;

    remainingQty -= closeQty;
    remainingProceeds -= proceedsPortion;

    if (first.quantityMinor === 0n) {
      input.lots.shift();
    }
  }

  if (remainingQty > 0n) {
    input.lots.push({ quantityMinor: -remainingQty, totalCostMinor: remainingProceeds });
  }
}

export type ComputeTickerPnl360Input = {
  userId: string;
  baseCurrency: string;
  asOf: Date;
  transactions: PnlTransactionInput[];
  positionSnapshots: PnlPositionSnapshotInput[];
  fx?: FxRateProvider;
};

export function computeTickerPnl360(input: ComputeTickerPnl360Input): {
  totals: TickerPnlTotalRow[];
  daily: TickerPnlDailyRow[];
  anomalies: string[];
} {
  const baseCurrency = normalizeCurrency(input.baseCurrency);
  const asOf = input.asOf;
  const asOfDateKey = formatDateKey(asOf);
  const fx = input.fx ?? createDefaultFxProvider();

  const totalsBySymbol = new Map<string, PnlAccumulator>();
  const dailyBySymbolAndDate = new Map<string, DailyAccumulator>();
  const lotsBySymbol = new Map<string, PnlLot[]>();
  const anomalies: string[] = [];

  const ordered = [...input.transactions].sort((a, b) => {
    const t = a.executedAt.getTime() - b.executedAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });

  for (const tx of ordered) {
    const symbol = deriveSymbol(tx);
    if (!symbol) continue;

    const kind = classifyTransaction(tx);
    const dateKey = formatDateKey(tx.executedAt);
    const dailyKey = `${symbol}#${dateKey}`;
    const totalsAcc = ensureAccumulator(totalsBySymbol, symbol);
    const dailyAcc = ensureDailyAccumulator(dailyBySymbolAndDate, dailyKey);

    const grossCurrency = deriveGrossCurrency(tx, baseCurrency);
    const feesCurrency = deriveFeesCurrency(tx, grossCurrency);

    const grossMinor = deriveGrossMinor(tx);
    const feesMinor = deriveFeesMinor(tx);

    const fxOverride = parseExplicitFxRateScaled(tx.raw);
    const fxForTx: FxRateProvider = fxOverride
      ? {
          getRateScaled: ({ from, to, asOf }) => {
            const fromNorm = normalizeCurrency(from);
            const toNorm = normalizeCurrency(to);
            if (
              fromNorm === normalizeCurrency(fxOverride.from) &&
              toNorm === normalizeCurrency(fxOverride.to)
            ) {
              return BigInt(Math.round(fxOverride.rate * 1_000_000_000));
            }
            return fx.getRateScaled({ from: fromNorm, to: toNorm, asOf });
          },
        }
      : fx;

    const grossBase =
      grossMinor !== null
        ? convertMinorAmount({
            amountMinor: grossMinor,
            fromCurrency: grossCurrency,
            toCurrency: baseCurrency,
            asOf: tx.executedAt,
            fx: fxForTx,
          })
        : null;
    const feesBase =
      feesMinor !== null
        ? convertMinorAmount({
            amountMinor: feesMinor,
            fromCurrency: feesCurrency,
            toCurrency: baseCurrency,
            asOf: tx.executedAt,
            fx: fxForTx,
          })
        : null;

    if (feesBase && feesBase.ok) {
      applyFees(totalsAcc, dailyAcc, absBigInt(feesBase.amountMinor));
    } else if (feesMinor !== null && feesCurrency !== baseCurrency) {
      anomalies.push(`fees_fx_missing:${symbol}:${tx.id}`);
    }

    if (kind === "fee") {
      const feeCandidate = feesBase?.ok
        ? absBigInt(feesBase.amountMinor)
        : grossBase?.ok
          ? absBigInt(grossBase.amountMinor)
          : 0n;
      applyFees(totalsAcc, dailyAcc, feeCandidate);
      continue;
    }

    if (kind === "dividend") {
      if (grossBase?.ok) {
        applyDividend(totalsAcc, dailyAcc, absBigInt(grossBase.amountMinor));
      } else if (grossMinor !== null && grossCurrency !== baseCurrency) {
        anomalies.push(`gross_fx_missing:${symbol}:${tx.id}`);
      }
      continue;
    }

    if (kind === "option_buy" || kind === "option_sell") {
      if (grossBase?.ok) {
        applyOptionPremium(
          totalsAcc,
          dailyAcc,
          absBigInt(grossBase.amountMinor),
          kind === "option_sell" ? "sell" : "buy",
        );
      } else if (grossMinor !== null && grossCurrency !== baseCurrency) {
        anomalies.push(`gross_fx_missing:${symbol}:${tx.id}`);
      }
      continue;
    }

    if (kind === "stock_buy" || kind === "stock_sell") {
      const qtyMinor = parseQuantityMinor(tx.quantity);
      if (qtyMinor === null || qtyMinor === 0n) {
        anomalies.push(`quantity_missing:${symbol}:${tx.id}`);
        continue;
      }
      if (!grossBase?.ok) {
        if (grossMinor !== null && grossCurrency !== baseCurrency) {
          anomalies.push(`gross_fx_missing:${symbol}:${tx.id}`);
        }
        continue;
      }

      const lots = lotsBySymbol.get(symbol) ?? [];
      lotsBySymbol.set(symbol, lots);

      if (kind === "stock_buy") {
        processStockBuy({
          lots,
          qtyMinor: absBigInt(qtyMinor),
          costMinor: absBigInt(grossBase.amountMinor),
          totals: totalsAcc,
          daily: dailyAcc,
        });
      } else {
        processStockSell({
          lots,
          qtyMinor: absBigInt(qtyMinor),
          proceedsMinor: absBigInt(grossBase.amountMinor),
          totals: totalsAcc,
          daily: dailyAcc,
        });
      }
    }
  }

  for (const snapshot of input.positionSnapshots) {
    const symbolRaw = snapshot.instrument.symbol;
    if (!symbolRaw || !symbolRaw.trim()) continue;
    const symbol = normalizeSymbol(symbolRaw);

    const totalsAcc = ensureAccumulator(totalsBySymbol, symbol);
    const dailyAcc = ensureDailyAccumulator(dailyBySymbolAndDate, `${symbol}#${asOfDateKey}`);

    const mvCurrency = normalizeCurrency(
      snapshot.marketValueCurrency ?? snapshot.instrument.currency ?? baseCurrency,
    );
    const pnlCurrency = normalizeCurrency(
      snapshot.unrealizedPnlCurrency ?? snapshot.instrument.currency ?? baseCurrency,
    );

    if (snapshot.marketValueAmountMinor !== null) {
      const converted = convertMinorAmount({
        amountMinor: snapshot.marketValueAmountMinor,
        fromCurrency: mvCurrency,
        toCurrency: baseCurrency,
        asOf: snapshot.asOf,
        fx,
      });
      if (converted.ok) {
        totalsAcc.marketValue += converted.amountMinor;
        dailyAcc.marketValue += converted.amountMinor;
      } else if (mvCurrency !== baseCurrency) {
        anomalies.push(`market_value_fx_missing:${symbol}`);
      }
    }

    if (snapshot.unrealizedPnlAmountMinor !== null) {
      const converted = convertMinorAmount({
        amountMinor: snapshot.unrealizedPnlAmountMinor,
        fromCurrency: pnlCurrency,
        toCurrency: baseCurrency,
        asOf: snapshot.asOf,
        fx,
      });
      if (converted.ok) {
        totalsAcc.unrealized += converted.amountMinor;
        dailyAcc.unrealized += converted.amountMinor;
      } else if (pnlCurrency !== baseCurrency) {
        anomalies.push(`unrealized_fx_missing:${symbol}`);
      }
    }
  }

  const totals: TickerPnlTotalRow[] = [];
  for (const [symbol, acc] of totalsBySymbol.entries()) {
    const net = acc.realized + acc.unrealized + acc.optionPremiums + acc.dividends - acc.fees;
    totals.push({
      symbol,
      baseCurrency,
      realizedPnlMinor: acc.realized,
      unrealizedPnlMinor: acc.unrealized,
      optionPremiumsMinor: acc.optionPremiums,
      dividendsMinor: acc.dividends,
      feesMinor: acc.fees,
      netPnlMinor: net,
      lastRecomputedAt: asOf,
    });
  }

  totals.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const daily: TickerPnlDailyRow[] = [];
  const dailyBySymbol = new Map<string, Array<{ dateKey: string; acc: DailyAccumulator }>>();
  for (const [key, acc] of dailyBySymbolAndDate.entries()) {
    const [symbol, dateKey] = key.split("#", 2);
    if (!symbol || !dateKey) continue;
    const arr = dailyBySymbol.get(symbol) ?? [];
    arr.push({ dateKey, acc });
    dailyBySymbol.set(symbol, arr);
  }

  for (const [symbol, entries] of dailyBySymbol.entries()) {
    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    let realized = 0n;
    let optionPremiums = 0n;
    let dividends = 0n;
    let fees = 0n;

    for (const entry of entries) {
      realized += entry.acc.realized;
      optionPremiums += entry.acc.optionPremiums;
      dividends += entry.acc.dividends;
      fees += entry.acc.fees;

      const net = realized + entry.acc.unrealized + optionPremiums + dividends - fees;
      daily.push({
        symbol,
        baseCurrency,
        date: new Date(entry.dateKey),
        netPnlMinor: net,
        marketValueMinor: entry.acc.marketValue,
        realizedPnlMinor: realized,
        unrealizedPnlMinor: entry.acc.unrealized,
      });
    }
  }

  daily.sort((a, b) => {
    const sym = a.symbol.localeCompare(b.symbol);
    if (sym !== 0) return sym;
    return a.date.getTime() - b.date.getTime();
  });

  return { totals, daily, anomalies };
}
