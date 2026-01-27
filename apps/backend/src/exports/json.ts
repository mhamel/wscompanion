import type { PrismaClient } from "@prisma/client";
import type { ExportType } from "./types";

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      return v;
    },
    2,
  );
}

export async function generateExportJson(input: {
  prisma: PrismaClient;
  userId: string;
  type: ExportType;
  params?: unknown;
}): Promise<{ filename: string; contentType: string; body: Buffer }> {
  const today = new Date().toISOString().slice(0, 10);

  if (input.type !== "user_data") {
    throw new Error(`Unsupported export type for JSON: ${input.type}`);
  }

  const user = await input.prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const [
    preferences,
    connections,
    accounts,
    transactions,
    tickerPnlTotals,
    tickerPnlDaily,
    wheelCycles,
    wheelAuditEvents,
    alertRules,
    alertEvents,
  ] = await Promise.all([
    input.prisma.userPreferences.findUnique({ where: { userId: input.userId } }),
    input.prisma.brokerConnection.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        provider: true,
        status: true,
        externalUserId: true,
        externalConnectionId: true,
        scopes: true,
        connectedAt: true,
        disconnectedAt: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    input.prisma.account.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "asc" },
    }),
    input.prisma.transaction.findMany({
      where: { userId: input.userId },
      include: {
        instrument: true,
        optionContract: { include: { underlyingInstrument: true } },
      },
      orderBy: [{ executedAt: "asc" }, { id: "asc" }],
      take: 200_000,
    }),
    input.prisma.tickerPnlTotal.findMany({
      where: { userId: input.userId },
      orderBy: { symbol: "asc" },
      take: 50_000,
    }),
    input.prisma.tickerPnlDaily.findMany({
      where: { userId: input.userId },
      orderBy: [{ symbol: "asc" }, { date: "asc" }],
      take: 200_000,
    }),
    input.prisma.wheelCycle.findMany({
      where: { userId: input.userId },
      include: { legs: true },
      orderBy: { openedAt: "asc" },
      take: 50_000,
    }),
    input.prisma.wheelAuditEvent.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "asc" },
      take: 200_000,
    }),
    input.prisma.alertRule.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    }),
    input.prisma.alertEvent.findMany({
      where: { alertRule: { userId: input.userId } },
      orderBy: { triggeredAt: "asc" },
      take: 200_000,
    }),
  ]);

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    },
    preferences: preferences
      ? {
          baseCurrency: preferences.baseCurrency,
          createdAt: preferences.createdAt.toISOString(),
          updatedAt: preferences.updatedAt.toISOString(),
        }
      : null,
    connections,
    accounts,
    transactions,
    tickerPnlTotals,
    tickerPnlDaily,
    wheel: {
      cycles: wheelCycles,
      auditEvents: wheelAuditEvents,
    },
    alerts: {
      rules: alertRules,
      events: alertEvents,
    },
  };

  const body = Buffer.from(safeJsonStringify(payload) + "\n", "utf8");
  return {
    filename: `user_data_${today}.json`,
    contentType: "application/json; charset=utf-8",
    body,
  };
}
