import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { getRiskDisclaimerText, RISK_DISCLAIMER_VERSION } from "../disclaimer";

async function disclaimerGetHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user.sub } });

  return {
    version: RISK_DISCLAIMER_VERSION,
    text: getRiskDisclaimerText(),
    acceptedAt: prefs?.riskDisclaimerAcceptedAt
      ? prefs.riskDisclaimerAcceptedAt.toISOString()
      : undefined,
    acceptedVersion: prefs?.riskDisclaimerVersionAccepted ?? undefined,
  };
}

async function disclaimerAcceptHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const now = new Date();

  const updated = await prisma.userPreferences.upsert({
    where: { userId: req.user.sub },
    create: {
      userId: req.user.sub,
      baseCurrency: "USD",
      riskDisclaimerAcceptedAt: now,
      riskDisclaimerVersionAccepted: RISK_DISCLAIMER_VERSION,
    },
    update: {
      riskDisclaimerAcceptedAt: now,
      riskDisclaimerVersionAccepted: RISK_DISCLAIMER_VERSION,
    },
  });

  return {
    ok: true,
    acceptedAt: updated.riskDisclaimerAcceptedAt?.toISOString(),
    version: updated.riskDisclaimerVersionAccepted ?? RISK_DISCLAIMER_VERSION,
  };
}

export function registerDisclaimerRoutes(app: FastifyInstance) {
  app.get("/disclaimer", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            version: { type: "string" },
            text: { type: "string" },
            acceptedAt: { type: "string", format: "date-time" },
            acceptedVersion: { type: "string" },
          },
          required: ["version", "text"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: disclaimerGetHandler,
  });

  app.post("/disclaimer/accept", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            acceptedAt: { type: "string", format: "date-time" },
            version: { type: "string" },
          },
          required: ["ok", "version"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: disclaimerAcceptHandler,
  });
}
