import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { ALERT_TEMPLATES, getAlertTemplate } from "../alerts/templates";
import { AppError } from "../errors";
import { getEntitlement } from "../entitlements";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";

async function alertTemplatesHandler() {
  return { items: ALERT_TEMPLATES };
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

async function alertRulesListHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const entitlement = await getEntitlement(req);
  if (entitlement.plan !== "pro") {
    return { items: [] };
  }

  const query = req.query as { limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 50, max: 100 });

  const rows = await prisma.alertRule.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      symbol: r.symbol ?? undefined,
      config: r.config as unknown,
      enabled: r.enabled,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function alertRuleCreateHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as {
    type?: unknown;
    symbol?: unknown;
    config?: unknown;
    enabled?: unknown;
  };

  const type = typeof body.type === "string" ? body.type.trim() : "";
  const template = type ? getAlertTemplate(type) : undefined;
  if (!template) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Unknown alert type",
      statusCode: 400,
    });
  }

  const symbolRaw = typeof body.symbol === "string" ? body.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (template.requiresSymbol && !symbol) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Symbol is required for this alert type",
      statusCode: 400,
    });
  }

  const config =
    body.config && typeof body.config === "object" && !Array.isArray(body.config)
      ? (body.config as Prisma.InputJsonValue)
      : undefined;

  if (!config) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid config",
      statusCode: 400,
    });
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

  const created = await prisma.alertRule.create({
    data: {
      userId: req.user.sub,
      type: template.type,
      symbol: symbol || null,
      config,
      enabled,
    },
  });

  return { ok: true, id: created.id };
}

async function alertRulePatchHandler(req: FastifyRequest) {
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
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const existing = await prisma.alertRule.findFirst({ where: { id, userId: req.user.sub } });
  if (!existing) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const template = getAlertTemplate(existing.type);
  if (!template) {
    throw new AppError({
      code: "ALERT_TYPE_NOT_SUPPORTED",
      message: "Alert type not supported",
      statusCode: 422,
    });
  }

  const body = req.body as {
    symbol?: unknown;
    config?: unknown;
    enabled?: unknown;
  };

  const symbolRaw = typeof body.symbol === "string" ? body.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (template.requiresSymbol && body.symbol !== undefined && !symbol) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Symbol is required for this alert type",
      statusCode: 400,
    });
  }

  const config =
    body.config === undefined
      ? undefined
      : body.config && typeof body.config === "object" && !Array.isArray(body.config)
        ? (body.config as Prisma.InputJsonValue)
        : undefined;

  if (body.config !== undefined && !config) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid config",
      statusCode: 400,
    });
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

  await prisma.alertRule.update({
    where: { id: existing.id },
    data: {
      ...(body.symbol !== undefined ? { symbol: symbol || null } : {}),
      ...(config !== undefined ? { config } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  });

  return { ok: true };
}

async function alertRuleDeleteHandler(req: FastifyRequest) {
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
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const existing = await prisma.alertRule.findFirst({ where: { id, userId: req.user.sub } });
  if (!existing) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  await prisma.$transaction([
    prisma.alertEvent.deleteMany({ where: { alertRuleId: existing.id } }),
    prisma.alertRule.delete({ where: { id: existing.id } }),
  ]);

  return { ok: true };
}

type AlertEventsCursor = { triggeredAt: string; id: string };

async function alertEventsListHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const entitlement = await getEntitlement(req);
  if (entitlement.plan !== "pro") {
    return { items: [] };
  }

  const query = req.query as { cursor?: unknown; limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 20, max: 50 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<AlertEventsCursor>(cursorRaw) : null;
  if (
    cursorRaw &&
    (!cursor || typeof cursor.triggeredAt !== "string" || typeof cursor.id !== "string")
  ) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const triggeredAtCursor = cursor ? new Date(cursor.triggeredAt) : null;
  if (cursor && !Number.isFinite(triggeredAtCursor?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const rows = await prisma.alertEvent.findMany({
    where: {
      alertRule: { userId: req.user.sub },
      ...(cursor
        ? {
            OR: [
              { triggeredAt: { lt: triggeredAtCursor! } },
              { triggeredAt: triggeredAtCursor!, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: { alertRule: true },
    orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((e) => ({
      id: e.id,
      alertRuleId: e.alertRuleId,
      type: e.alertRule.type,
      symbol: e.alertRule.symbol ?? undefined,
      triggeredAt: e.triggeredAt.toISOString(),
      deliveredAt: e.deliveredAt ? e.deliveredAt.toISOString() : undefined,
      payload: e.payload as unknown,
    })),
    nextCursor: next
      ? encodeCursor({ triggeredAt: next.triggeredAt.toISOString(), id: next.id })
      : undefined,
  };
}

export function registerAlertsRoutes(app: FastifyInstance) {
  const alertRuleSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      type: { type: "string" },
      symbol: { type: "string" },
      config: { type: "object", additionalProperties: true },
      enabled: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "type", "config", "enabled", "createdAt"],
  } as const;

  app.get("/alerts/templates", {
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
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  requiresSymbol: { type: "boolean" },
                  defaultConfig: { type: "object", additionalProperties: true },
                },
                required: ["type", "title", "description", "requiresSymbol", "defaultConfig"],
              },
            },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: alertTemplatesHandler,
  });

  app.get("/alerts", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: { limit: { type: "string" } },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: { type: "array", items: alertRuleSchema },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: alertRulesListHandler,
  });

  app.post("/alerts", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          symbol: { type: "string" },
          config: { type: "object", additionalProperties: true },
          enabled: { type: "boolean" },
        },
        required: ["type", "config"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" }, id: { type: "string" } },
          required: ["ok", "id"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: alertRuleCreateHandler,
  });

  app.patch("/alerts/:id", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          config: { type: "object", additionalProperties: true },
          enabled: { type: "boolean" },
        },
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
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: alertRulePatchHandler,
  });

  app.delete("/alerts/:id", {
    preHandler: [app.authenticate, app.requirePro],
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
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: alertRuleDeleteHandler,
  });

  app.get("/alerts/events", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: { $ref: "PaginationCursor#" },
          limit: { type: "string" },
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
                  alertRuleId: { type: "string" },
                  type: { type: "string" },
                  symbol: { type: "string" },
                  triggeredAt: { type: "string", format: "date-time" },
                  deliveredAt: { type: "string", format: "date-time" },
                  payload: { type: "object", additionalProperties: true },
                },
                required: ["id", "alertRuleId", "type", "triggeredAt", "payload"],
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
    handler: alertEventsListHandler,
  });
}
