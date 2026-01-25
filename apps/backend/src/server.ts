import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { AppError } from "./errors";
import type { PrismaClient } from "@prisma/client";
import { registerAuthRoutes } from "./routes/auth";

type BuildServerOptions = {
  logger?: boolean;
  prisma?: PrismaClient;
};

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

  app.register(swagger, {
    openapi: {
      info: {
        title: "JUSTLOVETHESTOCKS API",
        version: "0.0.0",
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
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
    },
    { prefix: "/v1" },
  );

  return app;
}
