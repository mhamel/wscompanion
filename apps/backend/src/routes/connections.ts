import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { encryptStringToBytes } from "../crypto";
import { AppError } from "../errors";

const STATE_TTL_SECONDS = 10 * 60;
const localStateStore = new Map<string, { userId: string; expiresAt: number }>();

function stateKey(state: string): string {
  return `snaptrade:state:${state}`;
}

async function saveState(req: FastifyRequest, state: string): Promise<void> {
  const redis = req.server.redis;
  if (redis) {
    try {
      await redis.setEx(stateKey(state), STATE_TTL_SECONDS, req.user.sub);
      return;
    } catch {
      // fall back to memory
    }
  }

  localStateStore.set(state, {
    userId: req.user.sub,
    expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
  });
}

async function consumeState(req: FastifyRequest, state: string): Promise<boolean> {
  const redis = req.server.redis;
  if (redis) {
    try {
      const stored = await redis.get(stateKey(state));
      if (stored !== req.user.sub) return false;
      await redis.del(stateKey(state));
      return true;
    } catch {
      // fall back to memory
    }
  }

  const local = localStateStore.get(state);
  if (!local) return false;
  localStateStore.delete(state);
  return local.userId === req.user.sub && Date.now() <= local.expiresAt;
}

async function snaptradeStartHandler(req: FastifyRequest) {
  const state = crypto.randomUUID();
  await saveState(req, state);

  const baseUrl = process.env.SNAPTRADE_CONNECT_URL?.trim() || "https://snaptrade.example/connect";
  const redirectUrl = `${baseUrl}?state=${encodeURIComponent(state)}`;

  return { redirectUrl, state };
}

async function snaptradeCallbackHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as {
    state?: unknown;
    externalUserId?: unknown;
    externalConnectionId?: unknown;
    accessToken?: unknown;
    refreshToken?: unknown;
    scopes?: unknown;
  };

  const state = typeof body.state === "string" ? body.state.trim() : "";
  const externalUserId = typeof body.externalUserId === "string" ? body.externalUserId.trim() : "";
  const externalConnectionId =
    typeof body.externalConnectionId === "string" ? body.externalConnectionId.trim() : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  const scopes =
    Array.isArray(body.scopes) && body.scopes.every((s) => typeof s === "string")
      ? (body.scopes as string[])
      : [];

  if (!state || !externalUserId || !externalConnectionId || !accessToken) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid callback payload",
      statusCode: 400,
    });
  }

  const ok = await consumeState(req, state);
  if (!ok) {
    throw new AppError({ code: "INVALID_STATE", message: "Invalid state", statusCode: 400 });
  }

  const now = new Date();
  const provider = "snaptrade";
  const accessTokenEnc = encryptStringToBytes(accessToken);
  const refreshTokenEnc = refreshToken ? encryptStringToBytes(refreshToken) : undefined;

  const brokerConnection = await prisma.brokerConnection.upsert({
    where: { provider_externalConnectionId: { provider, externalConnectionId } },
    create: {
      userId: req.user.sub,
      provider,
      status: "connected",
      externalUserId,
      externalConnectionId,
      accessTokenEnc,
      refreshTokenEnc,
      scopes,
      connectedAt: now,
    },
    update: {
      status: "connected",
      externalUserId,
      accessTokenEnc,
      refreshTokenEnc,
      scopes,
      connectedAt: now,
      disconnectedAt: null,
    },
  });

  const syncRun = await prisma.syncRun.create({
    data: {
      userId: req.user.sub,
      brokerConnectionId: brokerConnection.id,
      status: "queued",
    },
  });

  const syncQueue = req.server.syncQueue;
  if (!syncQueue) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "failed", error: "SYNC_QUEUE_NOT_CONFIGURED" },
    });
    throw new AppError({
      code: "QUEUE_NOT_CONFIGURED",
      message: "Sync queue is not configured",
      statusCode: 500,
    });
  }

  try {
    await syncQueue.add(
      "sync-initial",
      { syncRunId: syncRun.id, brokerConnectionId: brokerConnection.id, userId: req.user.sub },
      { jobId: syncRun.id, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
    );
  } catch {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "failed", error: "ENQUEUE_FAILED" },
    });
    throw new AppError({
      code: "ENQUEUE_FAILED",
      message: "Failed to enqueue sync job",
      statusCode: 500,
    });
  }

  return { ok: true, brokerConnectionId: brokerConnection.id, syncRunId: syncRun.id };
}

async function connectionsListHandler(req: FastifyRequest) {
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

  return {
    items: connections.map((connection) => ({
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      connectedAt: connection.connectedAt.toISOString(),
      disconnectedAt: connection.disconnectedAt ? connection.disconnectedAt.toISOString() : undefined,
      lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : undefined,
    })),
  };
}

async function connectionsDisconnectHandler(req: FastifyRequest) {
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

  const now = new Date();
  await prisma.brokerConnection.update({
    where: { id: brokerConnection.id },
    data: {
      status: "disconnected",
      disconnectedAt: brokerConnection.disconnectedAt ?? now,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      scopes: [],
      raw: Prisma.DbNull,
    },
  });

  return { ok: true };
}

export function registerConnectionRoutes(app: FastifyInstance) {
  app.get("/connections", {
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
                  id: { type: "string" },
                  provider: { type: "string" },
                  status: { type: "string" },
                  connectedAt: { type: "string", format: "date-time" },
                  disconnectedAt: { type: "string", format: "date-time" },
                  lastSyncAt: { type: "string", format: "date-time" },
                },
                required: ["id", "provider", "status", "connectedAt"],
              },
            },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: connectionsListHandler,
  });

  app.delete("/connections/:id", {
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
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: connectionsDisconnectHandler,
  });

  app.post("/connections/snaptrade/start", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            redirectUrl: { type: "string" },
            state: { type: "string" },
          },
          required: ["redirectUrl", "state"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: snaptradeStartHandler,
  });

  app.post("/connections/snaptrade/callback", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          state: { type: "string" },
          externalUserId: { type: "string" },
          externalConnectionId: { type: "string" },
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
          scopes: { type: "array", items: { type: "string" } },
        },
        required: ["state", "externalUserId", "externalConnectionId", "accessToken"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            brokerConnectionId: { type: "string" },
            syncRunId: { type: "string" },
          },
          required: ["ok", "brokerConnectionId", "syncRunId"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: snaptradeCallbackHandler,
  });
}
