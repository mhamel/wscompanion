import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";

type AuditCursor = { createdAt: string; id: string };

async function auditEventsListHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as { cursor?: unknown; limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 50, max: 200 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<AuditCursor>(cursorRaw) : null;
  if (
    cursorRaw &&
    (!cursor || typeof cursor.createdAt !== "string" || typeof cursor.id !== "string")
  ) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const createdAtCursor = cursor ? new Date(cursor.createdAt) : null;
  if (cursor && !Number.isFinite(createdAtCursor?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const rows = await prisma.auditEvent.findMany({
    where: {
      userId: req.user.sub,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: createdAtCursor! } },
              { createdAt: createdAtCursor!, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? undefined,
      payload: e.payload ?? undefined,
      requestId: e.requestId ?? undefined,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor: next
      ? encodeCursor({ createdAt: next.createdAt.toISOString(), id: next.id })
      : undefined,
  };
}

export function registerAuditRoutes(app: FastifyInstance) {
  app.get("/audit/events", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: { $ref: "PaginationCursor#" },
          limit: { type: "integer" },
        },
      },
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
                  action: { type: "string" },
                  entityType: { type: "string" },
                  entityId: { type: "string" },
                  payload: { type: ["object", "array", "string", "number", "boolean", "null"] },
                  requestId: { type: "string" },
                  createdAt: { type: "string" },
                },
                required: ["id", "action", "entityType", "createdAt"],
              },
            },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: auditEventsListHandler,
  });
}
