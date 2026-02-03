import type { FastifyRequest } from "fastify";
import { AppError } from "./errors";
import { RISK_DISCLAIMER_VERSION } from "./disclaimer";

export async function requireRiskDisclaimerAccepted(req: FastifyRequest): Promise<void> {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: req.user.sub },
    select: {
      riskDisclaimerAcceptedAt: true,
      riskDisclaimerVersionAccepted: true,
    },
  });

  const acceptedAt = prefs?.riskDisclaimerAcceptedAt ?? null;
  const acceptedVersion = prefs?.riskDisclaimerVersionAccepted ?? null;

  const isAccepted = Boolean(acceptedAt) && acceptedVersion === RISK_DISCLAIMER_VERSION;
  if (!isAccepted) {
    throw new AppError({
      code: "DISCLAIMER_REQUIRED",
      message: "Risk disclaimer must be accepted",
      statusCode: 403,
      details: {
        requiredVersion: RISK_DISCLAIMER_VERSION,
        acceptedAt: acceptedAt ? acceptedAt.toISOString() : null,
        acceptedVersion,
      },
    });
  }
}
