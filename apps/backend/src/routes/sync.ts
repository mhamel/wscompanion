import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";

async function connectionSyncHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const syncQueue = req.server.syncQueue;
  if (!syncQueue) {
    throw new AppError({
      code: "QUEUE_NOT_CONFIGURED",
      message: "Sync queue is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid connection id",
      statusCode: 400,
    });
  }

  const brokerConnection = await prisma.brokerConnection.findFirst({
    where: { id, userId: req.user.sub },
  });
  if (!brokerConnection) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  if (brokerConnection.status !== "connected") {
    throw new AppError({
      code: "CONNECTION_NOT_CONNECTED",
      message: "Connection is not connected",
      statusCode: 409,
    });
  }

  const inflight = await prisma.syncRun.findFirst({
    where: {
      brokerConnectionId: brokerConnection.id,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (inflight) {
    return { syncRunId: inflight.id, status: inflight.status };
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      userId: req.user.sub,
      brokerConnectionId: brokerConnection.id,
      status: "queued",
    },
  });

  try {
    await syncQueue.add(
      "sync-incremental",
      { syncRunId: syncRun.id, brokerConnectionId: brokerConnection.id, userId: req.user.sub },
      { jobId: syncRun.id, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
    );
  } catch {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "failed", finishedAt: new Date(), error: "ENQUEUE_FAILED" },
    });
    throw new AppError({
      code: "ENQUEUE_FAILED",
      message: "Failed to enqueue sync job",
      statusCode: 500,
    });
  }

  return { syncRunId: syncRun.id, status: syncRun.status };
}

async function syncStatusHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const connections = await prisma.brokerConnection.findMany({
    where: { userId: req.user.sub },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const items = [];
  for (const connection of connections) {
    const lastRun = await prisma.syncRun.findFirst({
      where: { brokerConnectionId: connection.id },
      orderBy: { createdAt: "desc" },
    });

    items.push({
      brokerConnectionId: connection.id,
      provider: connection.provider,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : undefined,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            createdAt: lastRun.createdAt.toISOString(),
            startedAt: lastRun.startedAt ? lastRun.startedAt.toISOString() : undefined,
            finishedAt: lastRun.finishedAt ? lastRun.finishedAt.toISOString() : undefined,
            error: lastRun.error ?? undefined,
          }
        : undefined,
    });
  }

  return { items };
}

export function registerSyncRoutes(app: FastifyInstance) {
  app.post("/connections/:id/sync", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            syncRunId: { type: "string" },
            status: { type: "string" },
          },
          required: ["syncRunId", "status"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        409: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: connectionSyncHandler,
  });

  app.get("/sync/status", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
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
                  brokerConnectionId: { type: "string" },
                  provider: { type: "string" },
                  status: { type: "string" },
                  lastSyncAt: { type: "string", format: "date-time" },
                  lastRun: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      status: { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                      startedAt: { type: "string", format: "date-time" },
                      finishedAt: { type: "string", format: "date-time" },
                      error: { type: "string" },
                    },
                    required: ["id", "status", "createdAt"],
                  },
                },
                required: ["brokerConnectionId", "provider", "status"],
              },
            },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: syncStatusHandler,
  });
}
