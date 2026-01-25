import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { parseLimit } from "../pagination";
import { convertMinorAmount, createEnvFxRateProvider } from "../analytics/fx";

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function money(amountMinor: bigint, currency: string) {
  return { amountMinor: amountMinor.toString(), currency: normalizeCurrency(currency) };
}

async function wheelDetectHandler(req: FastifyRequest) {
  const queue = req.server.analyticsQueue;
  if (!queue) {
    throw new AppError({
      code: "QUEUE_NOT_CONFIGURED",
      message: "Analytics queue is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { symbol?: unknown };
  const symbolRaw = typeof body.symbol === "string" ? body.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";

  if (body.symbol !== undefined && !symbol) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid symbol",
      statusCode: 400,
    });
  }

  const jobId = `wheel-detect:${req.user.sub}:${symbol || "all"}`;
  const job = await queue.add(
    "wheel-detect",
    { userId: req.user.sub, ...(symbol ? { symbol } : {}) },
    { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
  );

  return { ok: true, jobId: job.id ? String(job.id) : jobId };
}

async function wheelCyclesHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as { symbol?: unknown; status?: unknown; limit?: unknown };
  const symbolRaw = typeof query.symbol === "string" ? query.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (query.symbol !== undefined && !symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const statusRaw = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  const status = statusRaw === "open" || statusRaw === "closed" ? statusRaw : "";
  if (query.status !== undefined && !status) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid status", statusCode: 400 });
  }

  const limit = parseLimit(query.limit, { defaultValue: 50, max: 100 });

  const rows = await prisma.wheelCycle.findMany({
    where: {
      userId: req.user.sub,
      ...(symbol ? { symbol } : {}),
      ...(status ? { status } : {}),
    },
    include: { _count: { select: { legs: true } } },
    orderBy: { openedAt: "desc" },
    take: limit,
  });

  return {
    items: rows.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      status: c.status,
      openedAt: c.openedAt.toISOString(),
      closedAt: c.closedAt ? c.closedAt.toISOString() : undefined,
      baseCurrency: c.baseCurrency,
      netPnl: c.netPnlMinor !== null ? money(c.netPnlMinor, c.baseCurrency) : undefined,
      autoDetected: c.autoDetected,
      legCount: c._count.legs,
    })),
  };
}

async function wheelCycleByIdHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const cycle = await prisma.wheelCycle.findFirst({
    where: { id, userId: req.user.sub },
    include: {
      legs: {
        include: {
          transaction: { include: { instrument: true, optionContract: true } },
        },
        orderBy: { occurredAt: "asc" },
      },
    },
  });

  if (!cycle) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const fx = createEnvFxRateProvider();
  let optionPremiumsMinor = 0n;
  let stockCashflowMinor = 0n;

  for (const leg of cycle.legs) {
    const tx = leg.transaction;
    if (!tx || tx.grossAmountMinor === null) continue;

    const grossMinor = absBigInt(tx.grossAmountMinor);
    const currency = normalizeCurrency(
      tx.priceCurrency ?? tx.instrument?.currency ?? tx.optionContract?.currency ?? cycle.baseCurrency,
    );

    const converted = convertMinorAmount({
      amountMinor: grossMinor,
      fromCurrency: currency,
      toCurrency: cycle.baseCurrency,
      asOf: tx.executedAt,
      fx,
    });
    if (!converted.ok) continue;

    if (leg.kind === "sold_put" || leg.kind === "sold_call") {
      optionPremiumsMinor += absBigInt(converted.amountMinor);
    } else if (leg.kind === "bought_put") {
      optionPremiumsMinor -= absBigInt(converted.amountMinor);
    } else if (leg.kind === "stock_buy") {
      stockCashflowMinor -= absBigInt(converted.amountMinor);
    } else if (leg.kind === "stock_sell") {
      stockCashflowMinor += absBigInt(converted.amountMinor);
    }
  }

  return {
    id: cycle.id,
    symbol: cycle.symbol,
    status: cycle.status,
    openedAt: cycle.openedAt.toISOString(),
    closedAt: cycle.closedAt ? cycle.closedAt.toISOString() : undefined,
    baseCurrency: cycle.baseCurrency,
    netPnl: cycle.netPnlMinor !== null ? money(cycle.netPnlMinor, cycle.baseCurrency) : undefined,
    autoDetected: cycle.autoDetected,
    notes: cycle.notes ?? undefined,
    aggregates: {
      optionPremiums: money(optionPremiumsMinor, cycle.baseCurrency),
      stockPnl: cycle.status === "closed" ? money(stockCashflowMinor, cycle.baseCurrency) : undefined,
    },
    legs: cycle.legs.map((leg) => ({
      id: leg.id,
      kind: leg.kind,
      occurredAt: leg.occurredAt.toISOString(),
      transactionId: leg.transactionId ?? undefined,
      linkedTransactionIds: leg.linkedTransactionIds ?? [],
      pnl: leg.pnlMinor !== null ? money(leg.pnlMinor, cycle.baseCurrency) : undefined,
    })),
  };
}

export function registerWheelRoutes(app: FastifyInstance) {
  const wheelLegSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      kind: { type: "string" },
      occurredAt: { type: "string", format: "date-time" },
      transactionId: { type: "string" },
      linkedTransactionIds: { type: "array", items: { type: "string" } },
      pnl: { $ref: "Money#" },
    },
    required: ["id", "kind", "occurredAt", "linkedTransactionIds"],
  } as const;

  app.post("/wheel/detect", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            jobId: { type: "string" },
          },
          required: ["ok", "jobId"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelDetectHandler,
  });

  app.get("/wheel/cycles", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          status: { type: "string", enum: ["open", "closed"] },
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
                  symbol: { type: "string" },
                  status: { type: "string" },
                  openedAt: { type: "string", format: "date-time" },
                  closedAt: { type: "string", format: "date-time" },
                  baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
                  netPnl: { $ref: "Money#" },
                  autoDetected: { type: "boolean" },
                  legCount: { type: "integer" },
                },
                required: ["id", "symbol", "status", "openedAt", "baseCurrency", "autoDetected", "legCount"],
              },
            },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCyclesHandler,
  });

  app.get("/wheel/cycles/:id", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            symbol: { type: "string" },
            status: { type: "string" },
            openedAt: { type: "string", format: "date-time" },
            closedAt: { type: "string", format: "date-time" },
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
            netPnl: { $ref: "Money#" },
            autoDetected: { type: "boolean" },
            notes: { type: "string" },
            aggregates: {
              type: "object",
              additionalProperties: false,
              properties: {
                optionPremiums: { $ref: "Money#" },
                stockPnl: { $ref: "Money#" },
              },
              required: ["optionPremiums"],
            },
            legs: { type: "array", items: wheelLegSchema },
          },
          required: ["id", "symbol", "status", "openedAt", "baseCurrency", "autoDetected", "aggregates", "legs"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCycleByIdHandler,
  });
}
