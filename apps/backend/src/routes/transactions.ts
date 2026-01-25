import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";

type TransactionsCursor = { executedAt: string; id: string };

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

async function transactionsHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as {
    accountId?: unknown;
    symbol?: unknown;
    type?: unknown;
    from?: unknown;
    to?: unknown;
    cursor?: unknown;
    limit?: unknown;
  };

  const accountId = typeof query.accountId === "string" ? query.accountId : "";
  const symbol = typeof query.symbol === "string" ? query.symbol.trim().toUpperCase() : "";
  const type = typeof query.type === "string" ? query.type.trim() : "";
  const from = query.from ? parseDate(query.from) : null;
  const to = query.to ? parseDate(query.to) : null;

  if (query.from && !from) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid 'from' date",
      statusCode: 400,
    });
  }
  if (query.to && !to) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid 'to' date", statusCode: 400 });
  }

  const limit = parseLimit(query.limit, { defaultValue: 50, max: 100 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<TransactionsCursor>(cursorRaw) : null;
  if (
    cursorRaw &&
    (!cursor || typeof cursor.executedAt !== "string" || typeof cursor.id !== "string")
  ) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }
  const executedAtCursor = cursor ? new Date(cursor.executedAt) : null;
  if (cursor && !Number.isFinite(executedAtCursor?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const and = [
    { userId: req.user.sub },
    ...(accountId ? [{ accountId }] : []),
    ...(type ? [{ type }] : []),
    ...(from || to
      ? [
          {
            executedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          },
        ]
      : []),
    ...(symbol
      ? [
          {
            OR: [
              { instrument: { symbol } },
              { optionContract: { underlyingInstrument: { symbol } } },
            ],
          },
        ]
      : []),
    ...(cursor
      ? [
          {
            OR: [
              { executedAt: { lt: executedAtCursor! } },
              { executedAt: executedAtCursor!, id: { lt: cursor.id } },
            ],
          },
        ]
      : []),
  ];

  const rows = await prisma.transaction.findMany({
    where: { AND: and },
    include: {
      instrument: true,
      optionContract: { include: { underlyingInstrument: true } },
    },
    orderBy: [{ executedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((t) => {
      const symbolValue =
        t.instrument?.symbol ?? t.optionContract?.underlyingInstrument?.symbol ?? undefined;
      const inferredCurrency =
        t.priceCurrency ?? t.instrument?.currency ?? t.optionContract?.currency ?? undefined;

      return {
        id: t.id,
        accountId: t.accountId,
        executedAt: t.executedAt.toISOString(),
        type: t.type,
        symbol: symbolValue,
        quantity: t.quantity?.toString(),
        price:
          t.priceAmountMinor !== null && t.priceCurrency
            ? { amountMinor: t.priceAmountMinor.toString(), currency: t.priceCurrency }
            : undefined,
        grossAmount:
          t.grossAmountMinor !== null && inferredCurrency
            ? { amountMinor: t.grossAmountMinor.toString(), currency: inferredCurrency }
            : undefined,
        fees:
          t.feesAmountMinor !== null && t.feesCurrency
            ? { amountMinor: t.feesAmountMinor.toString(), currency: t.feesCurrency }
            : undefined,
        instrument: t.instrument
          ? {
              id: t.instrument.id,
              type: t.instrument.type,
              symbol: t.instrument.symbol ?? undefined,
              exchange: t.instrument.exchange ?? undefined,
              currency: t.instrument.currency,
              name: t.instrument.name ?? undefined,
            }
          : undefined,
        optionContract: t.optionContract
          ? {
              id: t.optionContract.id,
              occSymbol: t.optionContract.occSymbol,
              expiry: t.optionContract.expiry.toISOString().slice(0, 10),
              strike: t.optionContract.strike.toString(),
              right: t.optionContract.right,
              multiplier: t.optionContract.multiplier,
              currency: t.optionContract.currency,
              underlyingSymbol: t.optionContract.underlyingInstrument.symbol ?? undefined,
            }
          : undefined,
        notes: t.notes ?? undefined,
      };
    }),
    nextCursor: next
      ? encodeCursor({ executedAt: next.executedAt.toISOString(), id: next.id })
      : undefined,
  };
}

export function registerTransactionsRoutes(app: FastifyInstance) {
  app.get("/transactions", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          accountId: { type: "string" },
          symbol: { type: "string" },
          type: { type: "string" },
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
          cursor: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100 },
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
                  accountId: { type: "string" },
                  executedAt: { type: "string", format: "date-time" },
                  type: { type: "string" },
                  symbol: { type: "string" },
                  quantity: { type: "string" },
                  price: { $ref: "Money#" },
                  grossAmount: { $ref: "Money#" },
                  fees: { $ref: "Money#" },
                  instrument: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      type: { type: "string" },
                      symbol: { type: "string" },
                      exchange: { type: "string" },
                      currency: { type: "string", pattern: "^[A-Z]{3}$" },
                      name: { type: "string" },
                    },
                    required: ["id", "type", "currency"],
                  },
                  optionContract: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      occSymbol: { type: "string" },
                      expiry: { type: "string" },
                      strike: { type: "string" },
                      right: { type: "string" },
                      multiplier: { type: "integer" },
                      currency: { type: "string", pattern: "^[A-Z]{3}$" },
                      underlyingSymbol: { type: "string" },
                    },
                    required: [
                      "id",
                      "occSymbol",
                      "expiry",
                      "strike",
                      "right",
                      "multiplier",
                      "currency",
                    ],
                  },
                  notes: { type: "string" },
                },
                required: ["id", "accountId", "executedAt", "type"],
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
    handler: transactionsHandler,
  });
}
