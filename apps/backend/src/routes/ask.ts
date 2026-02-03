import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { buildAskResponse, extractSymbolFromQuestion, normalizeSymbol } from "../assistant/ask";

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

  if (!question) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "question is required",
      statusCode: 400,
    });
  }

  const symbolFromQuestion = extractSymbolFromQuestion(question);
  const symbol = symbolRaw
    ? normalizeSymbol(symbolRaw)
    : symbolFromQuestion
      ? normalizeSymbol(symbolFromQuestion)
      : null;

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

  return buildAskResponse({
    question,
    symbol: symbol ?? undefined,
    baseCurrency,
    pnlTotal,
    transactionsSince,
    transactionsCount: txCount,
    news,
  });
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
        },
        required: ["question"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            answer: { type: "string" },
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
          required: ["answer", "sections"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: askHandler,
  });
}
