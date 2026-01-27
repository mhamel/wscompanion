import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server";

describe("DELETE /v1/me", () => {
  if (!process.env.DATABASE_URL) {
    it.skip("requires DATABASE_URL (Postgres)", () => {});
    return;
  }

  const prisma = new PrismaClient();
  const app = buildServer({ logger: false, prisma });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("soft-deletes user and purges owned data", async () => {
    const email = `test+${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email } });

    await prisma.userPreferences.create({ data: { userId: user.id, baseCurrency: "USD" } });
    await prisma.device.create({
      data: { userId: user.id, platform: "ios", pushToken: `push-${user.id}` },
    });
    await prisma.entitlement.create({
      data: { userId: user.id, type: "pro", status: "active" },
    });
    await prisma.authOtp.create({
      data: {
        email,
        codeSalt: "salt",
        codeHashHex: "hash",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const brokerConnection = await prisma.brokerConnection.create({
      data: {
        userId: user.id,
        provider: "snaptrade",
        status: "connected",
        externalUserId: "ext-user",
        externalConnectionId: crypto.randomUUID(),
        scopes: ["read"],
        connectedAt: new Date(),
      },
    });
    await prisma.syncRun.create({
      data: {
        userId: user.id,
        brokerConnectionId: brokerConnection.id,
        status: "queued",
      },
    });

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        brokerConnectionId: brokerConnection.id,
        externalAccountId: crypto.randomUUID(),
        name: "Main",
        type: "cash",
        baseCurrency: "USD",
        status: "active",
      },
    });
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        provider: "snaptrade",
        externalId: crypto.randomUUID(),
        executedAt: new Date(),
        type: "BUY",
      },
    });
    await prisma.tickerPnlTotal.create({
      data: {
        userId: user.id,
        symbol: "AAPL",
        baseCurrency: "USD",
        realizedPnlMinor: 0n,
        unrealizedPnlMinor: 0n,
        optionPremiumsMinor: 0n,
        dividendsMinor: 0n,
        feesMinor: 0n,
        netPnlMinor: 0n,
        lastRecomputedAt: new Date(),
      },
    });
    await prisma.tickerPnlDaily.create({
      data: {
        userId: user.id,
        symbol: "AAPL",
        baseCurrency: "USD",
        date: new Date("2026-01-01"),
        netPnlMinor: 0n,
        marketValueMinor: 0n,
        realizedPnlMinor: 0n,
        unrealizedPnlMinor: 0n,
      },
    });

    const wheelCycle = await prisma.wheelCycle.create({
      data: {
        userId: user.id,
        symbol: "AAPL",
        status: "open",
        openedAt: new Date(),
        baseCurrency: "USD",
      },
    });
    await prisma.wheelLeg.create({
      data: {
        wheelCycleId: wheelCycle.id,
        kind: "sell_put",
        occurredAt: new Date(),
        linkedTransactionIds: [],
      },
    });
    await prisma.wheelAuditEvent.create({
      data: {
        userId: user.id,
        wheelCycleId: wheelCycle.id,
        action: "test",
        payload: { ok: true },
      },
    });

    const alertRule = await prisma.alertRule.create({
      data: {
        userId: user.id,
        type: "price",
        symbol: "AAPL",
        config: { above: 100 },
        enabled: true,
      },
    });
    await prisma.alertEvent.create({
      data: {
        alertRuleId: alertRule.id,
        triggeredAt: new Date(),
        payload: { ok: true },
      },
    });

    const exportJob = await prisma.exportJob.create({
      data: {
        userId: user.id,
        type: "transactions",
        format: "csv",
        params: {},
        status: "completed",
        completedAt: new Date(),
      },
    });
    await prisma.exportFile.create({
      data: {
        exportJobId: exportJob.id,
        storageKey: "exports/test.csv",
        contentType: "text/csv",
        sizeBytes: 1n,
        sha256: Buffer.from("00".repeat(32), "hex"),
      },
    });

    const refreshTokenHash = crypto.randomBytes(32).toString("hex");
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const accessToken = app.jwt.sign({ sub: user.id, sid: session.id }, { expiresIn: 900 });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/me",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.deletedAt).toBeInstanceOf(Date);
    expect(updatedUser?.email).toMatch(/^deleted\\+.+@deleted\\.invalid$/);

    expect(await prisma.userPreferences.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.device.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.entitlement.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.session.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.authOtp.findMany({ where: { email } })).toHaveLength(0);

    expect(await prisma.brokerConnection.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.syncRun.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.account.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.transaction.findMany({ where: { userId: user.id } })).toHaveLength(0);

    expect(await prisma.tickerPnlTotal.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(await prisma.tickerPnlDaily.findMany({ where: { userId: user.id } })).toHaveLength(0);

    expect(await prisma.wheelCycle.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(
      await prisma.wheelLeg.findMany({ where: { wheelCycle: { userId: user.id } } }),
    ).toHaveLength(0);
    expect(await prisma.wheelAuditEvent.findMany({ where: { userId: user.id } })).toHaveLength(0);

    expect(await prisma.alertRule.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(
      await prisma.alertEvent.findMany({ where: { alertRule: { userId: user.id } } }),
    ).toHaveLength(0);

    expect(await prisma.exportJob.findMany({ where: { userId: user.id } })).toHaveLength(0);
    expect(
      await prisma.exportFile.findMany({ where: { exportJob: { userId: user.id } } }),
    ).toHaveLength(0);
  });
});
