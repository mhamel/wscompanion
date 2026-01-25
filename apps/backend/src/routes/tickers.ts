import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";
import { getTickerPnlTimelineCached, getTickerPnlTotalsCached } from "../analytics/pnlRead";
import { convertMinorAmount, createEnvFxRateProvider } from "../analytics/fx";

const QUANTITY_SCALE = 10n ** 10n;

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
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

function formatQuantity(quantityMinor: bigint): string {
  const sign = quantityMinor < 0n ? "-" : "";
  const abs = quantityMinor < 0n ? -quantityMinor : quantityMinor;
  const intPart = abs / QUANTITY_SCALE;
  const fracPart = abs % QUANTITY_SCALE;
  if (fracPart === 0n) return `${sign}${intPart.toString()}`;
  const frac = fracPart.toString().padStart(10, "0").replace(/0+$/, "");
  return `${sign}${intPart.toString()}.${frac}`;
}

function money(amountMinor: bigint, currency: string) {
  return { amountMinor: amountMinor.toString(), currency: normalizeCurrency(currency) };
}

type NewsCursor = { publishedAt: string; id: string };

async function getUserBaseCurrency(req: FastifyRequest): Promise<string> {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user.sub } });
  return normalizeCurrency(prefs?.baseCurrency ?? "USD");
}

function pnlObject(row: {
  baseCurrency: string;
  realizedPnlMinor: bigint;
  unrealizedPnlMinor: bigint;
  optionPremiumsMinor: bigint;
  dividendsMinor: bigint;
  feesMinor: bigint;
  netPnlMinor: bigint;
}) {
  return {
    net: money(row.netPnlMinor, row.baseCurrency),
    realized: money(row.realizedPnlMinor, row.baseCurrency),
    unrealized: money(row.unrealizedPnlMinor, row.baseCurrency),
    optionPremiums: money(row.optionPremiumsMinor, row.baseCurrency),
    dividends: money(row.dividendsMinor, row.baseCurrency),
    fees: money(row.feesMinor, row.baseCurrency),
  };
}

async function tickersHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const baseCurrency = await getUserBaseCurrency(req);

  const query = req.query as { limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 20, max: 100 });

  const rows = await getTickerPnlTotalsCached({
    prisma,
    redis: req.server.redis,
    userId: req.user.sub,
    baseCurrency,
  });

  const top = [...rows]
    .sort((a, b) => {
      if (a.netPnlMinor === b.netPnlMinor) return a.symbol.localeCompare(b.symbol);
      return a.netPnlMinor > b.netPnlMinor ? -1 : 1;
    })
    .slice(0, limit);

  return {
    items: top.map((row) => ({
      symbol: row.symbol,
      pnl: pnlObject(row),
      lastUpdatedAt: row.lastRecomputedAt.toISOString(),
    })),
  };
}

async function tickerSummaryHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { symbol?: unknown };
  const symbolRaw = typeof params.symbol === "string" ? params.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (!symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const baseCurrency = await getUserBaseCurrency(req);

  const totals = await getTickerPnlTotalsCached({
    prisma,
    redis: req.server.redis,
    userId: req.user.sub,
    baseCurrency,
  });
  const row = totals.find((r) => normalizeSymbol(r.symbol) === symbol);
  if (!row) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const positions = await prisma.positionSnapshot.findMany({
    where: {
      account: { userId: req.user.sub },
      instrument: { symbol },
    },
    include: { instrument: true },
    take: 10_000,
  });

  let quantityMinor = 0n;
  let totalCostBasisMinor = 0n;
  let totalMarketValueMinor = 0n;

  let avgCostCurrency: string | null = null;
  let marketValueCurrency: string | null = null;

  for (const p of positions) {
    const qtyMinor = parseDecimalToQuantityMinor(p.quantity.toString()) ?? 0n;
    quantityMinor += qtyMinor;

    if (!avgCostCurrency) avgCostCurrency = p.avgCostCurrency;
    if (avgCostCurrency === p.avgCostCurrency) {
      const costBasisForPosition = (p.avgCostAmountMinor * qtyMinor) / QUANTITY_SCALE;
      totalCostBasisMinor += costBasisForPosition;
    }

    if (p.marketValueAmountMinor !== null) {
      const currency = p.marketValueCurrency ?? p.instrument.currency;
      if (!marketValueCurrency) marketValueCurrency = currency;
      if (marketValueCurrency === currency) {
        totalMarketValueMinor += p.marketValueAmountMinor;
      }
    }
  }

  const avgCostMinor =
    quantityMinor !== 0n ? (totalCostBasisMinor * QUANTITY_SCALE) / quantityMinor : null;

  return {
    symbol: row.symbol,
    position:
      positions.length > 0
        ? {
            quantity: formatQuantity(quantityMinor),
            ...(avgCostMinor !== null && avgCostCurrency
              ? { avgCost: money(avgCostMinor, avgCostCurrency) }
              : {}),
            ...(marketValueCurrency ? { marketValue: money(totalMarketValueMinor, marketValueCurrency) } : {}),
          }
        : undefined,
    pnl: pnlObject(row),
    lastUpdatedAt: row.lastRecomputedAt.toISOString(),
  };
}

function classifyForBasis(type: string): "stock_buy" | "option_buy" | "other" {
  const t = type.trim().toLowerCase();
  if (!t) return "other";
  if (t.includes("dividend")) return "other";
  if (t.includes("fee") || t.includes("commission")) return "other";

  const isOption =
    t.includes("option") || t.includes("call") || t.includes("put") || t.includes("bto");
  if (isOption && (t.includes("buy") || t.includes("bto"))) return "option_buy";
  if (!isOption && t.includes("buy")) return "stock_buy";
  return "other";
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function divRound(numerator: bigint, divisor: bigint): bigint {
  if (divisor === 0n) throw new Error("Division by zero");
  const sign = numerator < 0n ? -1n : 1n;
  const absNum = absBigInt(numerator);
  const absDiv = absBigInt(divisor);
  const half = absDiv / 2n;
  const rounded = (absNum + half) / absDiv;
  return rounded * sign;
}

async function tickerPnlHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { symbol?: unknown };
  const symbolRaw = typeof params.symbol === "string" ? params.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (!symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const baseCurrency = await getUserBaseCurrency(req);

  const totals = await getTickerPnlTotalsCached({
    prisma,
    redis: req.server.redis,
    userId: req.user.sub,
    baseCurrency,
  });
  const row = totals.find((r) => normalizeSymbol(r.symbol) === symbol);
  if (!row) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const fx = createEnvFxRateProvider();

  const txs = await prisma.transaction.findMany({
    where: {
      userId: req.user.sub,
      OR: [
        { instrument: { symbol } },
        { optionContract: { underlyingInstrument: { symbol } } },
      ],
    },
    include: {
      instrument: true,
      optionContract: { include: { underlyingInstrument: true } },
    },
    orderBy: [{ executedAt: "asc" }, { id: "asc" }],
    take: 50_000,
  });

  let deployedCashMinor = 0n;
  for (const tx of txs) {
    const grossMinor = tx.grossAmountMinor !== null ? absBigInt(tx.grossAmountMinor) : 0n;
    const grossCurrency = normalizeCurrency(
      tx.priceCurrency ?? tx.instrument?.currency ?? tx.optionContract?.currency ?? baseCurrency,
    );

    const feesMinor = tx.feesAmountMinor !== null ? absBigInt(tx.feesAmountMinor) : 0n;
    const feesCurrency = normalizeCurrency(tx.feesCurrency ?? grossCurrency);

    const asOf = tx.executedAt;

    if (feesMinor > 0n) {
      const converted = convertMinorAmount({
        amountMinor: feesMinor,
        fromCurrency: feesCurrency,
        toCurrency: baseCurrency,
        asOf,
        fx,
      });
      if (converted.ok) {
        deployedCashMinor += absBigInt(converted.amountMinor);
      }
    }

    const kind = classifyForBasis(tx.type);
    if (kind === "stock_buy" || kind === "option_buy") {
      const converted = convertMinorAmount({
        amountMinor: grossMinor,
        fromCurrency: grossCurrency,
        toCurrency: baseCurrency,
        asOf,
        fx,
      });
      if (converted.ok) {
        deployedCashMinor += absBigInt(converted.amountMinor);
      }
    }
  }

  const percentBps = deployedCashMinor > 0n ? divRound(row.netPnlMinor * 10_000n, deployedCashMinor) : null;
  const returnPct = percentBps !== null ? Number(percentBps) / 100 : null;

  return {
    symbol: row.symbol,
    baseCurrency,
    pnl: pnlObject(row),
    deployedCash: money(deployedCashMinor, baseCurrency),
    returnOnDeployedCashPct: returnPct,
    lastUpdatedAt: row.lastRecomputedAt.toISOString(),
  };
}

function classifyStockSide(type: string): "buy" | "sell" | "other" {
  const t = type.trim().toLowerCase();
  if (!t) return "other";
  if (t.includes("buy")) return "buy";
  if (t.includes("sell")) return "sell";
  return "other";
}

async function tickerHoldHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { symbol?: unknown };
  const symbolRaw = typeof params.symbol === "string" ? params.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (!symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const baseCurrency = await getUserBaseCurrency(req);

  const totals = await getTickerPnlTotalsCached({
    prisma,
    redis: req.server.redis,
    userId: req.user.sub,
    baseCurrency,
  });
  const row = totals.find((r) => normalizeSymbol(r.symbol) === symbol);
  if (!row) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const fx = createEnvFxRateProvider();

  const stockTxs = await prisma.transaction.findMany({
    where: {
      userId: req.user.sub,
      instrument: { symbol },
    },
    include: { instrument: true },
    orderBy: [{ executedAt: "asc" }, { id: "asc" }],
    take: 50_000,
  });

  const firstBuy = stockTxs.find((tx) => classifyStockSide(tx.type) === "buy");
  if (!firstBuy) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires at least one buy transaction",
      statusCode: 422,
    });
  }

  const firstBuyQtyMinor =
    firstBuy.quantity !== null ? parseDecimalToQuantityMinor(firstBuy.quantity.toString()) : null;
  if (!firstBuyQtyMinor || firstBuyQtyMinor === 0n) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires buy quantity",
      statusCode: 422,
    });
  }

  const firstBuyGrossMinor = firstBuy.grossAmountMinor !== null ? absBigInt(firstBuy.grossAmountMinor) : null;
  const firstBuyGrossCurrency = normalizeCurrency(firstBuy.priceCurrency ?? firstBuy.instrument?.currency ?? baseCurrency);

  const firstBuyPriceMinorRaw =
    firstBuy.priceAmountMinor !== null
      ? firstBuy.priceAmountMinor
      : firstBuyGrossMinor !== null
        ? divRound(firstBuyGrossMinor * QUANTITY_SCALE, absBigInt(firstBuyQtyMinor))
        : null;

  if (firstBuyPriceMinorRaw === null) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires buy price or gross amount",
      statusCode: 422,
    });
  }

  const firstBuyPriceBase = convertMinorAmount({
    amountMinor: firstBuyPriceMinorRaw,
    fromCurrency: firstBuyGrossCurrency,
    toCurrency: baseCurrency,
    asOf: firstBuy.executedAt,
    fx,
  });
  if (!firstBuyPriceBase.ok) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires FX rate for first buy price",
      statusCode: 422,
    });
  }

  let heldQtyMinor = 0n;
  let maxHeldQtyMinor = 0n;
  for (const tx of stockTxs) {
    const side = classifyStockSide(tx.type);
    if (side === "other") continue;
    const qtyMinor = tx.quantity !== null ? parseDecimalToQuantityMinor(tx.quantity.toString()) : null;
    if (!qtyMinor) continue;
    heldQtyMinor += side === "buy" ? absBigInt(qtyMinor) : -absBigInt(qtyMinor);
    if (heldQtyMinor > maxHeldQtyMinor) maxHeldQtyMinor = heldQtyMinor;
  }

  if (maxHeldQtyMinor <= 0n) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires a positive held quantity",
      statusCode: 422,
    });
  }

  const snap = await prisma.positionSnapshot.findFirst({
    where: { account: { userId: req.user.sub }, instrument: { symbol } },
    include: { instrument: true },
    orderBy: { asOf: "desc" },
  });

  let referencePriceMinorRaw: bigint | null = null;
  let referencePriceCurrency: string | null = null;
  let referencePriceAsOf = new Date();

  if (snap) {
    referencePriceAsOf = snap.asOf;
    if (snap.marketPriceAmountMinor !== null) {
      referencePriceMinorRaw = snap.marketPriceAmountMinor;
      referencePriceCurrency = snap.marketPriceCurrency ?? snap.instrument.currency;
    } else if (snap.marketValueAmountMinor !== null && snap.quantity) {
      const qtyMinor = parseDecimalToQuantityMinor(snap.quantity.toString());
      if (qtyMinor && qtyMinor !== 0n) {
        referencePriceMinorRaw = divRound(snap.marketValueAmountMinor * QUANTITY_SCALE, absBigInt(qtyMinor));
        referencePriceCurrency = snap.marketValueCurrency ?? snap.instrument.currency;
      }
    }
  }

  if (referencePriceMinorRaw === null) {
    const lastWithPrice = [...stockTxs].reverse().find((tx) => tx.priceAmountMinor !== null);
    if (lastWithPrice) {
      referencePriceMinorRaw = lastWithPrice.priceAmountMinor!;
      referencePriceCurrency = normalizeCurrency(
        lastWithPrice.priceCurrency ?? lastWithPrice.instrument?.currency ?? baseCurrency,
      );
      referencePriceAsOf = lastWithPrice.executedAt;
    }
  }

  if (referencePriceMinorRaw === null || !referencePriceCurrency) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires a reference market price",
      statusCode: 422,
    });
  }

  const referencePriceBase = convertMinorAmount({
    amountMinor: referencePriceMinorRaw,
    fromCurrency: referencePriceCurrency,
    toCurrency: baseCurrency,
    asOf: referencePriceAsOf,
    fx,
  });
  if (!referencePriceBase.ok) {
    throw new AppError({
      code: "HOLD_NOT_AVAILABLE",
      message: "Hold comparison requires FX rate for reference price",
      statusCode: 422,
    });
  }

  const holdNetMinor = divRound(
    (referencePriceBase.amountMinor - firstBuyPriceBase.amountMinor) * maxHeldQtyMinor,
    QUANTITY_SCALE,
  );

  return {
    symbol: row.symbol,
    baseCurrency,
    actualNet: money(row.netPnlMinor, baseCurrency),
    holdNet: money(holdNetMinor, baseCurrency),
    deltaVsHold: money(row.netPnlMinor - holdNetMinor, baseCurrency),
    inputs: {
      firstBuyAt: firstBuy.executedAt.toISOString(),
      firstBuyPrice: money(firstBuyPriceBase.amountMinor, baseCurrency),
      referenceQuantity: formatQuantity(maxHeldQtyMinor),
      referencePriceAsOf: referencePriceAsOf.toISOString(),
      referencePrice: money(referencePriceBase.amountMinor, baseCurrency),
    },
    assumptions: [
      "Uses first buy price as entry price.",
      "Uses maximum shares held (from buy/sell history) as held quantity.",
      "Reference market price comes from latest position snapshot when available, otherwise last trade price.",
      "Ignores options, fees, dividends, and cashflow timing; for MVP only.",
    ],
  };
}

async function tickerTimelineHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { symbol?: unknown };
  const symbolRaw = typeof params.symbol === "string" ? params.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (!symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const baseCurrency = await getUserBaseCurrency(req);

  const rows = await getTickerPnlTimelineCached({
    prisma,
    redis: req.server.redis,
    userId: req.user.sub,
    baseCurrency,
    symbol,
  });

  return {
    symbol,
    baseCurrency,
    items: rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      net: money(row.netPnlMinor, row.baseCurrency),
      realized: money(row.realizedPnlMinor, row.baseCurrency),
      unrealized: money(row.unrealizedPnlMinor, row.baseCurrency),
      marketValue: money(row.marketValueMinor, row.baseCurrency),
    })),
  };
}

async function tickerNewsHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { symbol?: unknown };
  const symbolRaw = typeof params.symbol === "string" ? params.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (!symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const query = req.query as { cursor?: unknown; limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 20, max: 50 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<NewsCursor>(cursorRaw) : null;
  if (
    cursorRaw &&
    (!cursor || typeof cursor.publishedAt !== "string" || typeof cursor.id !== "string")
  ) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const publishedAtCursor = cursor ? new Date(cursor.publishedAt) : null;
  if (cursor && !Number.isFinite(publishedAtCursor?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const rows = await prisma.newsItem.findMany({
    where: {
      symbols: { some: { symbol } },
      ...(cursor
        ? {
            OR: [
              { publishedAt: { lt: publishedAtCursor! } },
              { publishedAt: publishedAtCursor!, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: { symbols: { select: { symbol: true } } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      publisher: item.publisher ?? undefined,
      publishedAt: item.publishedAt.toISOString(),
      symbols: item.symbols.map((s) => s.symbol),
      summary: item.summary ?? undefined,
    })),
    nextCursor: next
      ? encodeCursor({ publishedAt: next.publishedAt.toISOString(), id: next.id })
      : undefined,
  };
}

export function registerTickerRoutes(app: FastifyInstance) {
  const pnlSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      net: { $ref: "Money#" },
      realized: { $ref: "Money#" },
      unrealized: { $ref: "Money#" },
      optionPremiums: { $ref: "Money#" },
      dividends: { $ref: "Money#" },
      fees: { $ref: "Money#" },
    },
    required: ["net", "realized", "unrealized", "optionPremiums", "dividends", "fees"],
  } as const;

  app.get("/tickers", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: { limit: { type: "string" } },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  symbol: { type: "string" },
                  pnl: pnlSchema,
                  lastUpdatedAt: { type: "string", format: "date-time" },
                },
                required: ["symbol", "pnl", "lastUpdatedAt"],
              },
            },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: tickersHandler,
  });

  app.get("/tickers/:symbol/summary", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            symbol: { type: "string" },
            position: {
              type: "object",
              additionalProperties: false,
              properties: {
                quantity: { type: "string" },
                avgCost: { $ref: "Money#" },
                marketValue: { $ref: "Money#" },
              },
              required: ["quantity"],
            },
            pnl: pnlSchema,
            lastUpdatedAt: { type: "string", format: "date-time" },
          },
          required: ["symbol", "pnl", "lastUpdatedAt"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: tickerSummaryHandler,
  });

  app.get("/tickers/:symbol/pnl", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            symbol: { type: "string" },
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
            pnl: pnlSchema,
            deployedCash: { $ref: "Money#" },
            returnOnDeployedCashPct: { type: ["number", "null"] },
            lastUpdatedAt: { type: "string", format: "date-time" },
          },
          required: ["symbol", "baseCurrency", "pnl", "deployedCash", "returnOnDeployedCashPct", "lastUpdatedAt"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: tickerPnlHandler,
  });

  app.get("/tickers/:symbol/timeline", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            symbol: { type: "string" },
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  date: { type: "string", format: "date" },
                  net: { $ref: "Money#" },
                  realized: { $ref: "Money#" },
                  unrealized: { $ref: "Money#" },
                  marketValue: { $ref: "Money#" },
                },
                required: ["date", "net", "realized", "unrealized", "marketValue"],
              },
            },
          },
          required: ["symbol", "baseCurrency", "items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: tickerTimelineHandler,
  });

  app.get("/tickers/:symbol/news", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: { $ref: "PaginationCursor#" },
          limit: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  url: { type: "string" },
                  publisher: { type: "string" },
                  publishedAt: { type: "string", format: "date-time" },
                  symbols: { type: "array", items: { type: "string" } },
                  summary: { type: "string" },
                },
                required: ["id", "title", "url", "publishedAt", "symbols"],
              },
            },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: tickerNewsHandler,
  });

  app.get("/tickers/:symbol/hold", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            symbol: { type: "string" },
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
            actualNet: { $ref: "Money#" },
            holdNet: { $ref: "Money#" },
            deltaVsHold: { $ref: "Money#" },
            inputs: {
              type: "object",
              additionalProperties: false,
              properties: {
                firstBuyAt: { type: "string", format: "date-time" },
                firstBuyPrice: { $ref: "Money#" },
                referenceQuantity: { type: "string" },
                referencePriceAsOf: { type: "string", format: "date-time" },
                referencePrice: { $ref: "Money#" },
              },
              required: [
                "firstBuyAt",
                "firstBuyPrice",
                "referenceQuantity",
                "referencePriceAsOf",
                "referencePrice",
              ],
            },
            assumptions: { type: "array", items: { type: "string" } },
          },
          required: [
            "symbol",
            "baseCurrency",
            "actualNet",
            "holdNet",
            "deltaVsHold",
            "inputs",
            "assumptions",
          ],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        422: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: tickerHoldHandler,
  });
}
