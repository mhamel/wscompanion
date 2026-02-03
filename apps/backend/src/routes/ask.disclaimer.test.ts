import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RISK_DISCLAIMER_VERSION } from "../disclaimer";
import { buildServer } from "../server";

describe("POST /v1/ask (disclaimer gate)", () => {
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
    await prisma.$disconnect();
  });

  async function createAccessToken(userId: string): Promise<string> {
    const refreshTokenHash = crypto.randomBytes(32).toString("hex");
    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return app.jwt.sign({ sub: userId, sid: session.id }, { expiresIn: 900 });
  }

  it("returns DISCLAIMER_REQUIRED when the latest disclaimer is not accepted", async () => {
    const email = `test+${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email } });

    await prisma.entitlement.create({
      data: { userId: user.id, type: "pro", status: "active" },
    });

    const accessToken = await createAccessToken(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/v1/ask",
      headers: { Authorization: `Bearer ${accessToken}` },
      payload: { question: "Why?" },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json() as { code?: unknown; details?: unknown };
    expect(json.code).toBe("DISCLAIMER_REQUIRED");

    const details =
      json.details && typeof json.details === "object" && !Array.isArray(json.details)
        ? (json.details as Record<string, unknown>)
        : {};
    expect(details.requiredVersion).toBe(RISK_DISCLAIMER_VERSION);
  });

  it("allows Ask after disclaimer acceptance", async () => {
    const email = `test+${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email } });

    await prisma.entitlement.create({
      data: { userId: user.id, type: "pro", status: "active" },
    });

    await prisma.userPreferences.create({
      data: {
        userId: user.id,
        baseCurrency: "USD",
        riskDisclaimerAcceptedAt: new Date(),
        riskDisclaimerVersionAccepted: RISK_DISCLAIMER_VERSION,
      },
    });

    const accessToken = await createAccessToken(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/v1/ask",
      headers: { Authorization: `Bearer ${accessToken}` },
      payload: { question: "Can you analyze my portfolio?" },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json() as { answer?: unknown };
    expect(typeof json.answer).toBe("string");
  });
});
