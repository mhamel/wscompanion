import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";
import type { Queue } from "bullmq";
import { AppError } from "./errors";
import type { PrismaClient } from "@prisma/client";
import type { RedisClientType } from "redis";
import { registerAuthRoutes } from "./routes/auth";
import { registerAlertsRoutes } from "./routes/alerts";
import { registerBillingRoutes } from "./routes/billing";
import { registerConnectionRoutes } from "./routes/connections";
import { registerDeviceRoutes } from "./routes/devices";
import { registerPortfolioRoutes } from "./routes/portfolio";
import { registerSyncRoutes } from "./routes/sync";
import { registerTickerRoutes } from "./routes/tickers";
import { registerTransactionsRoutes } from "./routes/transactions";
import { registerWheelRoutes } from "./routes/wheel";

type BuildServerOptions = {
  logger?: boolean;
  prisma?: PrismaClient;
  redis?: RedisClientType;
  syncQueue?: Queue;
  analyticsQueue?: Queue;
};

function getJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (secret) return secret;

  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "production") return "dev-secret-change-me";

  throw new Error("AUTH_JWT_SECRET is required in production");
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: process.env.LOG_LEVEL ?? "info",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "req.body.code",
                "req.body.accessToken",
                "req.body.refreshToken",
              ],
              remove: true,
            },
          },
  });

  if (options.prisma) {
    app.decorate("prisma", options.prisma);
    app.addHook("onClose", async () => {
      await options.prisma?.$disconnect();
    });
  }

  if (options.redis) {
    app.decorate("redis", options.redis);
    app.addHook("onClose", async () => {
      try {
        await options.redis?.quit();
      } catch {
        // ignore
      }
    });
  }

  if (options.syncQueue) {
    app.decorate("syncQueue", options.syncQueue);
    app.addHook("onClose", async () => {
      try {
        await options.syncQueue?.close();
      } catch {
        // ignore
      }
    });
  }

  if (options.analyticsQueue) {
    app.decorate("analyticsQueue", options.analyticsQueue);
    app.addHook("onClose", async () => {
      try {
        await options.analyticsQueue?.close();
      } catch {
        // ignore
      }
    });
  }

  app.addSchema({
    $id: "ProblemDetails",
    type: "object",
    additionalProperties: false,
    properties: {
      code: { type: "string" },
      message: { type: "string" },
      details: {},
    },
    required: ["code", "message"],
  });

  app.addSchema({
    $id: "Money",
    type: "object",
    additionalProperties: false,
    properties: {
      amountMinor: { type: "string" },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
    },
    required: ["amountMinor", "currency"],
  });

  app.addSchema({
    $id: "PaginationCursor",
    type: "string",
  });

  app.addSchema({
    $id: "AuthTokens",
    type: "object",
    additionalProperties: false,
    properties: {
      accessToken: { type: "string" },
      refreshToken: { type: "string" },
    },
    required: ["accessToken", "refreshToken"],
  });

  app.addSchema({
    $id: "Me",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      email: { type: "string" },
    },
    required: ["id", "email"],
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: "JUSTLOVETHESTOCKS API",
        version: "0.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.register(jwt, { secret: getJwtSecret() });

  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
    }

    const prisma = request.server.prisma;
    if (!prisma) return;

    const now = new Date();
    const session = await prisma.session.findUnique({ where: { id: request.user.sid } });
    if (
      !session ||
      session.userId !== request.user.sub ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
    }
  });

  app.setNotFoundHandler(async (_req, reply) => {
    return reply.status(404).send({ code: "NOT_FOUND", message: "Not found" });
  });

  app.setErrorHandler(async (err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send(err.toProblemDetails());
    }

    return reply.status(500).send({ code: "INTERNAL_ERROR", message: "Internal error" });
  });

  // Liveness endpoint (infra)
  app.get("/health", async () => {
    return { ok: true };
  });

  // Versioned API routes
  app.register(
    async (v1) => {
      v1.get(
        "/health",
        {
          schema: {
            response: {
              200: {
                type: "object",
                additionalProperties: false,
                properties: {
                  ok: { type: "boolean" },
                },
                required: ["ok"],
              },
              default: { $ref: "ProblemDetails#" },
            },
          },
        },
        async () => {
          return { ok: true };
        },
      );

      registerAuthRoutes(v1);
      registerAlertsRoutes(v1);
      registerBillingRoutes(v1);
      registerConnectionRoutes(v1);
      registerDeviceRoutes(v1);
      registerPortfolioRoutes(v1);
      registerSyncRoutes(v1);
      registerTickerRoutes(v1);
      registerTransactionsRoutes(v1);
      registerWheelRoutes(v1);
    },
    { prefix: "/v1" },
  );

  return app;
}
