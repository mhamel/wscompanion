import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
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

  app.get("/health", async () => {
    return { ok: true };
  });

  return app;
}
