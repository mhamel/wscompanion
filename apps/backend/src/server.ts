import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { AppError } from "./errors";

type BuildServerOptions = {
  logger?: boolean;
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
                "req.body.refreshToken",
              ],
              remove: true,
            },
          },
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

  app.get("/health", async () => {
    return { ok: true };
  });

  return app;
}
