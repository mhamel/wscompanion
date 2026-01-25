import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";

type AccountsCursor = { createdAt: string; id: string };

async function accountsHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as { cursor?: unknown; limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 50, max: 100 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<AccountsCursor>(cursorRaw) : null;
  if (
    cursorRaw &&
    (!cursor || typeof cursor.createdAt !== "string" || typeof cursor.id !== "string")
  ) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const createdAtCursor = cursor ? new Date(cursor.createdAt) : null;
  if (cursor && !Number.isFinite(createdAtCursor?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const rows = await prisma.account.findMany({
    where: {
      userId: req.user.sub,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: createdAtCursor! } },
              { createdAt: createdAtCursor!, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      baseCurrency: a.baseCurrency,
      status: a.status,
      brokerConnectionId: a.brokerConnectionId ?? undefined,
      externalAccountId: a.externalAccountId ?? undefined,
    })),
    nextCursor: next
      ? encodeCursor({ createdAt: next.createdAt.toISOString(), id: next.id })
      : undefined,
  };
}

type PositionsCursor = { instrumentId: string };

async function positionsHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as { accountId?: unknown; cursor?: unknown; limit?: unknown };
  const accountId = typeof query.accountId === "string" ? query.accountId : "";
  if (!accountId) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "accountId is required",
      statusCode: 400,
    });
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: req.user.sub },
  });
  if (!account) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const limit = parseLimit(query.limit, { defaultValue: 50, max: 100 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<PositionsCursor>(cursorRaw) : null;
  if (cursorRaw && (!cursor || typeof cursor.instrumentId !== "string")) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const rows = await prisma.positionSnapshot.findMany({
    where: {
      accountId,
      ...(cursor ? { instrumentId: { gt: cursor.instrumentId } } : {}),
    },
    include: { instrument: true },
    orderBy: { instrumentId: "asc" },
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((p) => ({
      accountId: p.accountId,
      instrument: {
        id: p.instrument.id,
        type: p.instrument.type,
        symbol: p.instrument.symbol ?? undefined,
        exchange: p.instrument.exchange ?? undefined,
        currency: p.instrument.currency,
        name: p.instrument.name ?? undefined,
      },
      asOf: p.asOf.toISOString(),
      quantity: p.quantity.toString(),
      avgCost: { amountMinor: p.avgCostAmountMinor.toString(), currency: p.avgCostCurrency },
      marketValue:
        p.marketValueAmountMinor !== null && p.marketValueCurrency
          ? { amountMinor: p.marketValueAmountMinor.toString(), currency: p.marketValueCurrency }
          : undefined,
      unrealizedPnl:
        p.unrealizedPnlAmountMinor !== null && p.unrealizedPnlCurrency
          ? {
              amountMinor: p.unrealizedPnlAmountMinor.toString(),
              currency: p.unrealizedPnlCurrency,
            }
          : undefined,
    })),
    nextCursor: next ? encodeCursor({ instrumentId: next.instrumentId }) : undefined,
  };
}

export function registerPortfolioRoutes(app: FastifyInstance) {
  app.get("/accounts", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
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
                  name: { type: "string" },
                  type: { type: "string" },
                  baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
                  status: { type: "string" },
                  brokerConnectionId: { type: "string" },
                  externalAccountId: { type: "string" },
                },
                required: ["id", "name", "type", "baseCurrency", "status"],
              },
            },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: accountsHandler,
  });

  app.get("/positions", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          accountId: { type: "string" },
          cursor: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100 },
        },
        required: ["accountId"],
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
                  accountId: { type: "string" },
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
                  asOf: { type: "string", format: "date-time" },
                  quantity: { type: "string" },
                  avgCost: { $ref: "Money#" },
                  marketValue: { $ref: "Money#" },
                  unrealizedPnl: { $ref: "Money#" },
                },
                required: ["accountId", "instrument", "asOf", "quantity", "avgCost"],
              },
            },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: positionsHandler,
  });
}
