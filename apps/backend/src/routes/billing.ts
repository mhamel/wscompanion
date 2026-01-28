import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../errors";
import { getEntitlement } from "../entitlements";
import { trackProductEvent } from "../observability/productAnalytics";

async function billingEntitlementHandler(req: FastifyRequest) {
  const entitlement = await getEntitlement(req);
  return {
    plan: entitlement.plan,
    expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : undefined,
  };
}

const revenueCatWebhookSchema = z
  .object({
    event: z
      .object({
        id: z.string().optional(),
        type: z.string().optional(),
        app_user_id: z.string().optional(),
        original_app_user_id: z.string().optional(),
        entitlement_id: z.string().optional(),
        entitlement_ids: z.array(z.string()).optional(),
        entitlements: z.record(z.unknown()).optional(),
        product_id: z.string().optional(),
        purchased_at_ms: z.union([z.number(), z.string()]).optional().nullable(),
        expiration_at_ms: z.union([z.number(), z.string()]).optional().nullable(),
        expires_at_ms: z.union([z.number(), z.string()]).optional().nullable(),
      })
      .passthrough(),
  })
  .passthrough();

function getBearerToken(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^bearer\\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\\s+/i, "").trim() || null;
  }
  return trimmed;
}

function verifyRevenueCatWebhookAuth(req: FastifyRequest): void {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN?.trim();
  if (!expected) return;

  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : undefined;
  const headerToken = getBearerToken(authHeader);
  const fallbackToken =
    typeof req.headers["x-revenuecat-webhook-token"] === "string"
      ? req.headers["x-revenuecat-webhook-token"]
      : undefined;

  const provided = headerToken ?? getBearerToken(fallbackToken) ?? "";
  if (!provided || provided !== expected) {
    throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function dateFromEpochMs(value: unknown): Date | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const d = new Date(n);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function extractEntitlementIds(event: z.infer<typeof revenueCatWebhookSchema>["event"]): string[] {
  const ids = new Set<string>();
  if (typeof event.entitlement_id === "string") ids.add(event.entitlement_id);
  for (const id of event.entitlement_ids ?? []) {
    if (typeof id === "string") ids.add(id);
  }
  if (event.entitlements && typeof event.entitlements === "object") {
    for (const key of Object.keys(event.entitlements)) ids.add(key);
  }
  return [...ids];
}

async function revenueCatWebhookHandler(req: FastifyRequest) {
  verifyRevenueCatWebhookAuth(req);

  const parsed = revenueCatWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid RevenueCat webhook payload",
      statusCode: 400,
      details: parsed.error.flatten(),
    });
  }

  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const event = parsed.data.event;
  const userIdRaw = typeof event.app_user_id === "string" ? event.app_user_id.trim() : "";
  const userId = userIdRaw && isUuid(userIdRaw) ? userIdRaw : "";
  if (!userId) {
    return { ok: true };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return { ok: true };
  }

  const proEntitlementId = process.env.REVENUECAT_PRO_ENTITLEMENT_ID?.trim() || "pro";
  const entitlementIds = extractEntitlementIds(event);
  const hasPro = entitlementIds.includes(proEntitlementId);
  if (!hasPro) {
    return { ok: true };
  }

  const startedAt = dateFromEpochMs(event.purchased_at_ms) ?? new Date();
  const expiresAt =
    dateFromEpochMs(event.expiration_at_ms) ?? dateFromEpochMs(event.expires_at_ms) ?? null;

  const existing = await prisma.entitlement.findFirst({
    where: { userId, type: "pro" },
    orderBy: { createdAt: "desc" },
  });

  const previouslyActive =
    existing?.status === "active" && (!existing.expiresAt || existing.expiresAt > new Date());

  if (existing) {
    await prisma.entitlement.update({
      where: { id: existing.id },
      data: { status: "active", startedAt, expiresAt },
    });
  } else {
    await prisma.entitlement.create({
      data: { userId, type: "pro", status: "active", startedAt, expiresAt },
    });
  }

  const redis = req.server.redis;
  if (redis) {
    try {
      await redis.del(`entitlement:plan:${userId}`);
    } catch {
      // ignore cache errors
    }
  }

  if (!previouslyActive) {
    void trackProductEvent(
      {
        event: "entitlement_pro_activated",
        distinctId: userId,
        properties: {
          user_id: userId,
          plan: "pro",
          source: "webhook",
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          revenuecat_event_id: typeof event.id === "string" ? event.id : undefined,
          revenuecat_event_type: typeof event.type === "string" ? event.type : undefined,
        },
      },
      req.log,
    );
  }

  return { ok: true };
}

export function registerBillingRoutes(app: FastifyInstance) {
  app.get("/billing/entitlement", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            plan: { type: "string", enum: ["free", "pro"] },
            expiresAt: { type: "string", format: "date-time" },
          },
          required: ["plan"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: billingEntitlementHandler,
  });

  app.post("/billing/webhook/revenuecat", {
    schema: {
      body: { type: "object", additionalProperties: true },
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
    handler: revenueCatWebhookHandler,
  });
}
