import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

async function preferencesGetHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user.sub } });
  return { baseCurrency: normalizeCurrency(prefs?.baseCurrency ?? "USD") };
}

async function preferencesPutHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { baseCurrency?: unknown };
  const raw = typeof body.baseCurrency === "string" ? body.baseCurrency : "";
  const baseCurrency = raw ? normalizeCurrency(raw) : "";

  if (!/^[A-Z]{3}$/.test(baseCurrency)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid base currency",
      statusCode: 400,
    });
  }

  await prisma.userPreferences.upsert({
    where: { userId: req.user.sub },
    create: { userId: req.user.sub, baseCurrency },
    update: { baseCurrency },
  });

  return { baseCurrency };
}

export function registerPreferencesRoutes(app: FastifyInstance) {
  app.get("/preferences", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
          },
          required: ["baseCurrency"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: preferencesGetHandler,
  });

  app.put("/preferences", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
        },
        required: ["baseCurrency"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
          },
          required: ["baseCurrency"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: preferencesPutHandler,
  });
}

