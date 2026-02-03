import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestTransactions } from "./ingestTransactions";

describe("ingestTransactions", () => {
  if (!process.env.DATABASE_URL) {
    it.skip("requires DATABASE_URL (Postgres)", () => {});
    return;
  }

  const prisma = new PrismaClient();

  beforeAll(async () => {
    // ensure DB reachable
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is idempotent on (provider, accountId, externalId)", async () => {
    const email = `test+${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email } });

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

    const tx = {
      userId: user.id,
      accountId: account.id,
      provider: brokerConnection.provider,
      externalId: "tx-1",
      executedAt: new Date("2026-02-01T00:00:00Z"),
      type: "BUY",
      raw: { ok: true },
    };

    const first = await ingestTransactions(prisma, [tx]);
    expect(first.total).toBe(1);
    expect(first.inserted).toBe(1);
    expect(first.deduped).toBe(0);

    const second = await ingestTransactions(prisma, [tx]);
    expect(second.total).toBe(1);
    expect(second.inserted).toBe(0);
    expect(second.deduped).toBe(1);

    await prisma.user.delete({ where: { id: user.id } }).catch(() => {
      // ignore (other tests may delete)
    });
  });

  it("throws when instrumentId and optionContractId are both set", async () => {
    await expect(
      ingestTransactions(prisma, [
        {
          userId: crypto.randomUUID(),
          accountId: crypto.randomUUID(),
          provider: "snaptrade",
          externalId: "x",
          executedAt: new Date(),
          type: "BUY",
          instrumentId: crypto.randomUUID(),
          optionContractId: crypto.randomUUID(),
        },
      ]),
    ).rejects.toThrow(/mutually exclusive/i);
  });
});
