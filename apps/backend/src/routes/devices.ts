import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";

async function deviceRegisterHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { pushToken?: unknown; platform?: unknown };
  const pushToken = typeof body.pushToken === "string" ? body.pushToken.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim() : "";

  if (!pushToken || (platform !== "ios" && platform !== "android")) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid push token or platform",
      statusCode: 400,
    });
  }

  const now = new Date();
  const device = await prisma.device.upsert({
    where: {
      userId_pushToken: { userId: req.user.sub, pushToken },
    },
    create: {
      userId: req.user.sub,
      pushToken,
      platform,
      lastSeenAt: now,
    },
    update: {
      platform,
      lastSeenAt: now,
    },
  });

  return { id: device.id };
}

async function deviceDeleteHandler(req: FastifyRequest) {
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

  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid device id", statusCode: 400 });
  }

  const res = await prisma.device.deleteMany({
    where: { id, userId: req.user.sub },
  });

  if (res.count === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  return { ok: true };
}

export function registerDeviceRoutes(app: FastifyInstance) {
  app.post("/devices/register", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          pushToken: { type: "string" },
          platform: { type: "string", enum: ["ios", "android"] },
        },
        required: ["pushToken", "platform"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: deviceRegisterHandler,
  });

  app.delete("/devices/:id", {
    preHandler: app.authenticate,
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
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: deviceDeleteHandler,
  });
}
