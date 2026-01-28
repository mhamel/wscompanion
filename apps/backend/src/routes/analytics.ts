import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { getEntitlement } from "../entitlements";
import {
  PRODUCT_ANALYTICS_EVENT_NAMES,
  isProductAnalyticsEventName,
  trackProductEvent,
} from "../observability/productAnalytics";

function toPlainObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

async function analyticsEventHandler(req: FastifyRequest) {
  const body = req.body as { event?: unknown; properties?: unknown };
  const event = typeof body.event === "string" ? body.event.trim() : "";
  if (!event || !isProductAnalyticsEventName(event)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid analytics event",
      statusCode: 400,
      details: { allowed: PRODUCT_ANALYTICS_EVENT_NAMES },
    });
  }

  const properties = toPlainObject(body.properties) ?? {};

  let plan: "free" | "pro" | undefined;
  try {
    plan = (await getEntitlement(req)).plan;
  } catch {
    plan = undefined;
  }

  void trackProductEvent(
    {
      event,
      distinctId: req.user.sub,
      properties: {
        ...properties,
        user_id: req.user.sub,
        ...(plan ? { plan } : {}),
      },
    },
    req.log,
  );

  return { ok: true };
}

export function registerAnalyticsRoutes(app: FastifyInstance) {
  app.post("/analytics/event", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          event: { type: "string", enum: PRODUCT_ANALYTICS_EVENT_NAMES },
          properties: { type: "object", additionalProperties: true },
        },
        required: ["event"],
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
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: analyticsEventHandler,
  });
}

