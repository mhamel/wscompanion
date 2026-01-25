import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

async function wheelDetectHandler(req: FastifyRequest) {
  const queue = req.server.analyticsQueue;
  if (!queue) {
    throw new AppError({
      code: "QUEUE_NOT_CONFIGURED",
      message: "Analytics queue is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { symbol?: unknown };
  const symbolRaw = typeof body.symbol === "string" ? body.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";

  if (body.symbol !== undefined && !symbol) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid symbol",
      statusCode: 400,
    });
  }

  const jobId = `wheel-detect:${req.user.sub}:${symbol || "all"}`;
  const job = await queue.add(
    "wheel-detect",
    { userId: req.user.sub, ...(symbol ? { symbol } : {}) },
    { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
  );

  return { ok: true, jobId: job.id ? String(job.id) : jobId };
}

export function registerWheelRoutes(app: FastifyInstance) {
  app.post("/wheel/detect", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            jobId: { type: "string" },
          },
          required: ["ok", "jobId"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelDetectHandler,
  });
}
