import crypto from "node:crypto";
import type { FastifyRequest } from "fastify";

type PrismaLike = {
  auditEvent: {
    create: (args: {
      data: {
        userId: string;
        action: string;
        entityType: string;
        entityId?: string;
        payload?: unknown;
        requestId?: string;
        ipHashHex?: string;
        userAgentHashHex?: string;
      };
    }) => PromiseLike<unknown>;
  };
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
}

export function hashSensitiveValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return sha256Hex(trimmed);
}

export async function recordAuditEvent(
  req: FastifyRequest,
  input: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: unknown;
  },
): Promise<void> {
  const prisma = req.server.prisma as PrismaLike | undefined;
  if (!prisma) return;

  const userAgent = normalizeOptional(req.headers["user-agent"]);

  try {
    await prisma.auditEvent.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload,
        requestId: req.id,
        ipHashHex: hashSensitiveValue(req.ip),
        userAgentHashHex: hashSensitiveValue(userAgent),
      },
    });
  } catch {
    // ignore (e.g. user purged between request start and audit write)
  }
}
