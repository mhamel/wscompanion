import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { buildAskResponse, extractSymbolFromQuestion, normalizeSymbol } from "../assistant/ask";
import { inferSymbolFromThreadMessages } from "../assistant/askContext";
import { enforceAskQuota } from "../assistant/askQuota";
import { redactUserText } from "../assistant/redaction";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";

type AskThreadsCursor = { lastMessageAt: string; id: string };
type AskMessagesCursor = { createdAt: string; id: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function makeThreadTitle(input: { question: string; symbol?: string | null }): string {
  const symbol = input.symbol ? normalizeSymbol(input.symbol) : null;
  if (symbol) return `Ask: ${symbol}`;

  const q = input.question.trim();
  const redacted = redactUserText(q);
  const compact = redacted.replace(/\s+/g, " ").trim();
  if (!compact) return "Ask";
  return compact.length > 60 ? compact.slice(0, 60) + "…" : compact;
}

async function askHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { question?: unknown; symbol?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const symbolRaw = typeof body.symbol === "string" ? body.symbol.trim() : "";
  const threadIdRaw =
    typeof (body as { threadId?: unknown }).threadId === "string"
      ? ((body as { threadId?: string }).threadId ?? "").trim()
      : "";

  if (!question) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "question is required",
      statusCode: 400,
    });
  }

  if (threadIdRaw && !isUuid(threadIdRaw)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid threadId",
      statusCode: 400,
    });
  }

  await enforceAskQuota(req);

  const threadId = threadIdRaw || null;
  if (threadId) {
    const existing = await prisma.askThread.findFirst({
      where: { id: threadId, userId: req.user.sub },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError({ code: "NOT_FOUND", message: "Ask thread not found", statusCode: 404 });
    }
  }

  const symbolFromQuestion = extractSymbolFromQuestion(question);
  let symbol = symbolRaw
    ? normalizeSymbol(symbolRaw)
    : symbolFromQuestion
      ? normalizeSymbol(symbolFromQuestion)
      : null;

  if (!symbol && threadId) {
    const recent = await prisma.askMessage.findMany({
      where: { threadId, role: "user" },
      select: { data: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
    });
    symbol = inferSymbolFromThreadMessages(recent);
  }

  const preferences = await prisma.userPreferences.findUnique({ where: { userId: req.user.sub } });
  const baseCurrency = preferences?.baseCurrency ?? "USD";

  const transactionsSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [pnlTotal, txCount, news] = await Promise.all([
    symbol
      ? prisma.tickerPnlTotal.findFirst({
          where: { userId: req.user.sub, symbol, baseCurrency },
        })
      : Promise.resolve(null),
    symbol
      ? prisma.transaction.count({
          where: {
            userId: req.user.sub,
            executedAt: { gte: transactionsSince },
            OR: [
              { instrument: { symbol } },
              { optionContract: { underlyingInstrument: { symbol } } },
            ],
          },
        })
      : Promise.resolve(0),
    symbol
      ? prisma.newsItem.findMany({
          where: { symbols: { some: { symbol } } },
          select: { url: true, title: true, publisher: true, publishedAt: true },
          orderBy: { publishedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const response = buildAskResponse({
    question,
    symbol: symbol ?? undefined,
    baseCurrency,
    pnlTotal,
    transactionsSince,
    transactionsCount: txCount,
    news,
  });

  const now = new Date();

  const thread = await prisma.$transaction(async (tx) => {
    const existing = threadId
      ? await tx.askThread.findFirst({ where: { id: threadId, userId: req.user.sub } })
      : null;

    if (threadId && !existing) {
      throw new AppError({ code: "NOT_FOUND", message: "Ask thread not found", statusCode: 404 });
    }

    const created =
      existing ??
      (await tx.askThread.create({
        data: {
          userId: req.user.sub,
          title: makeThreadTitle({ question, symbol }),
          lastMessageAt: now,
        },
      }));

    await tx.askThread.update({
      where: { id: created.id },
      data: { lastMessageAt: now },
    });

    await tx.askMessage.create({
      data: {
        threadId: created.id,
        role: "user",
        content: redactUserText(question),
        data: symbol ? { symbol } : undefined,
      },
    });

    await tx.askMessage.create({
      data: {
        threadId: created.id,
        role: "assistant",
        content: response.answer,
        data: response,
      },
    });

    return created;
  });

  return { ...response, threadId: thread.id };
}

export function registerAskRoutes(app: FastifyInstance) {
  app.post("/ask", {
    preHandler: [app.authenticate, app.requirePro, app.requireRiskDisclaimer],
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          symbol: { type: "string" },
          threadId: { type: "string" },
        },
        required: ["question"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            answer: { type: "string" },
            threadId: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  sources: { type: "array", items: {} },
                },
                required: ["title", "bullets", "sources"],
              },
            },
          },
          required: ["answer", "sections", "threadId"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        429: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: askHandler,
  });

  app.get("/ask/threads", {
    preHandler: [app.authenticate, app.requirePro, app.requireRiskDisclaimer],
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: { $ref: "PaginationCursor#" },
          limit: { type: "number" },
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
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                  lastMessageAt: { type: "string", format: "date-time" },
                  messageCount: { type: "number" },
                },
                required: [
                  "id",
                  "title",
                  "createdAt",
                  "updatedAt",
                  "lastMessageAt",
                  "messageCount",
                ],
              },
            },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: async (req) => {
      const prisma = req.server.prisma;
      if (!prisma) {
        throw new AppError({
          code: "PRISMA_NOT_CONFIGURED",
          message: "Database is not configured",
          statusCode: 500,
        });
      }

      const query = req.query as { cursor?: unknown; limit?: unknown };
      const limit = parseLimit(query.limit, { defaultValue: 20, max: 50 });

      const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
      const cursor = cursorRaw ? decodeCursor<AskThreadsCursor>(cursorRaw) : null;
      if (
        cursorRaw &&
        (!cursor || typeof cursor.lastMessageAt !== "string" || typeof cursor.id !== "string")
      ) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Invalid cursor",
          statusCode: 400,
        });
      }

      const lastMessageAtCursor = cursor ? new Date(cursor.lastMessageAt) : null;
      if (cursor && !Number.isFinite(lastMessageAtCursor?.getTime())) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Invalid cursor",
          statusCode: 400,
        });
      }

      const rows = await prisma.askThread.findMany({
        where: {
          userId: req.user.sub,
          ...(cursor
            ? {
                OR: [
                  { lastMessageAt: { lt: lastMessageAtCursor! } },
                  { lastMessageAt: lastMessageAtCursor!, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        include: { _count: { select: { messages: true } } },
      });

      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1] : null;

      return {
        items: page.map((t) => ({
          id: t.id,
          title: t.title,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          lastMessageAt: t.lastMessageAt.toISOString(),
          messageCount: t._count.messages,
        })),
        nextCursor: next
          ? encodeCursor({ lastMessageAt: next.lastMessageAt.toISOString(), id: next.id })
          : undefined,
      };
    },
  });

  app.get("/ask/threads/:id", {
    preHandler: [app.authenticate, app.requirePro, app.requireRiskDisclaimer],
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: { $ref: "PaginationCursor#" },
          limit: { type: "number" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            thread: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                lastMessageAt: { type: "string", format: "date-time" },
              },
              required: ["id", "title", "createdAt", "updatedAt", "lastMessageAt"],
            },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  role: { type: "string" },
                  content: { type: "string" },
                  data: {},
                  createdAt: { type: "string", format: "date-time" },
                },
                required: ["id", "role", "content", "createdAt"],
              },
            },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["thread", "items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: async (req) => {
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
      if (!id || !isUuid(id)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
      }

      const thread = await prisma.askThread.findFirst({ where: { id, userId: req.user.sub } });
      if (!thread) {
        throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
      }

      const query = req.query as { cursor?: unknown; limit?: unknown };
      const limit = parseLimit(query.limit, { defaultValue: 30, max: 100 });

      const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
      const cursor = cursorRaw ? decodeCursor<AskMessagesCursor>(cursorRaw) : null;
      if (
        cursorRaw &&
        (!cursor || typeof cursor.createdAt !== "string" || typeof cursor.id !== "string")
      ) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Invalid cursor",
          statusCode: 400,
        });
      }

      const createdAtCursor = cursor ? new Date(cursor.createdAt) : null;
      if (cursor && !Number.isFinite(createdAtCursor?.getTime())) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Invalid cursor",
          statusCode: 400,
        });
      }

      const rows = await prisma.askMessage.findMany({
        where: {
          threadId: thread.id,
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
        thread: {
          id: thread.id,
          title: thread.title,
          createdAt: thread.createdAt.toISOString(),
          updatedAt: thread.updatedAt.toISOString(),
          lastMessageAt: thread.lastMessageAt.toISOString(),
        },
        items: page.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          data: m.data ?? undefined,
          createdAt: m.createdAt.toISOString(),
        })),
        nextCursor: next
          ? encodeCursor({ createdAt: next.createdAt.toISOString(), id: next.id })
          : undefined,
      };
    },
  });

  app.delete("/ask/threads/:id", {
    preHandler: [app.authenticate, app.requirePro, app.requireRiskDisclaimer],
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
          },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: async (req) => {
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
      if (!id || !isUuid(id)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
      }

      const thread = await prisma.askThread.findFirst({ where: { id, userId: req.user.sub } });
      if (!thread) {
        throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
      }

      await prisma.askThread.delete({ where: { id: thread.id } });
      return { ok: true };
    },
  });
}
