import type { FastifyRequest } from "fastify";
import { AppError } from "./errors";

export type EntitlementPlan = "free" | "pro";

export type EntitlementInfo = {
  plan: EntitlementPlan;
  expiresAt: Date | null;
};

function getProOverrideUserIds(): Set<string> {
  const raw = process.env.ENTITLEMENT_OVERRIDE_PRO_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set(ids);
}

function cacheKeyForUser(userId: string): string {
  return `entitlement:plan:${userId}`;
}

function computeCacheTtlSeconds(input: {
  plan: EntitlementPlan;
  expiresAt: Date | null;
  now: Date;
}): number {
  const fallback = 60;
  if (input.plan !== "pro" || !input.expiresAt) return fallback;

  const remaining = Math.floor((input.expiresAt.getTime() - input.now.getTime()) / 1000);
  if (remaining <= 0) return 1;
  return Math.min(fallback, remaining);
}

export async function getEntitlement(req: FastifyRequest): Promise<EntitlementInfo> {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const userId = req.user.sub;
  if (getProOverrideUserIds().has(userId)) {
    return { plan: "pro", expiresAt: null };
  }

  const redis = req.server.redis;
  const key = cacheKeyForUser(userId);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as { plan?: unknown; expiresAt?: unknown };
        const plan = parsed.plan === "pro" ? "pro" : "free";
        const expiresAt = typeof parsed.expiresAt === "string" ? new Date(parsed.expiresAt) : null;
        return {
          plan,
          expiresAt: expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
        };
      }
    } catch {
      // ignore cache errors
    }
  }

  const now = new Date();
  const pro = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "pro",
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });

  const plan: EntitlementPlan = pro ? "pro" : "free";
  const expiresAt = pro?.expiresAt ?? null;

  if (redis) {
    try {
      const ttlSeconds = computeCacheTtlSeconds({ plan, expiresAt, now });
      await redis.setEx(
        key,
        ttlSeconds,
        JSON.stringify({ plan, expiresAt: expiresAt?.toISOString() ?? null }),
      );
    } catch {
      // ignore cache errors
    }
  }

  return { plan, expiresAt };
}

export async function requirePro(req: FastifyRequest): Promise<void> {
  const entitlement = await getEntitlement(req);
  if (entitlement.plan !== "pro") {
    throw new AppError({
      code: "PAYWALL",
      message: "Pro subscription required",
      statusCode: 403,
      details: { plan: entitlement.plan },
    });
  }
}
