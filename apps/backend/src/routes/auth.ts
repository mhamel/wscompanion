import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import nodemailer from "nodemailer";
import { deleteExportObject } from "../exports/s3";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtpCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

type OtpConfig = {
  ttlSeconds: number;
  rateWindowSeconds: number;
  maxPerWindowPerEmail: number;
  maxAttempts: number;
  backoffMaxSeconds: number;
};

function getOtpConfig(): OtpConfig {
  const ttlSeconds = Number(process.env.AUTH_OTP_TTL_SECONDS ?? "600");
  const rateWindowSeconds = Number(process.env.AUTH_OTP_RATE_WINDOW_SECONDS ?? "600");
  const maxPerWindowPerEmail = Number(process.env.AUTH_OTP_RATE_MAX_PER_EMAIL ?? "3");
  const maxAttempts = Number(process.env.AUTH_OTP_MAX_ATTEMPTS ?? "5");
  const backoffMaxSeconds = Number(process.env.AUTH_OTP_BACKOFF_MAX_SECONDS ?? "60");

  return {
    ttlSeconds: Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 600,
    rateWindowSeconds:
      Number.isFinite(rateWindowSeconds) && rateWindowSeconds > 0 ? rateWindowSeconds : 600,
    maxPerWindowPerEmail:
      Number.isFinite(maxPerWindowPerEmail) && maxPerWindowPerEmail > 0 ? maxPerWindowPerEmail : 3,
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5,
    backoffMaxSeconds:
      Number.isFinite(backoffMaxSeconds) && backoffMaxSeconds > 0 ? backoffMaxSeconds : 60,
  };
}

type SessionConfig = {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
};

function getSessionConfig(): SessionConfig {
  const accessTokenTtlSeconds = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? "900");
  const refreshTokenTtlSeconds = Number(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? "2592000");

  return {
    accessTokenTtlSeconds:
      Number.isFinite(accessTokenTtlSeconds) && accessTokenTtlSeconds > 0
        ? accessTokenTtlSeconds
        : 900,
    refreshTokenTtlSeconds:
      Number.isFinite(refreshTokenTtlSeconds) && refreshTokenTtlSeconds > 0
        ? refreshTokenTtlSeconds
        : 2_592_000,
  };
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function deletedEmailForUser(userId: string): string {
  const rand = crypto.randomBytes(6).toString("hex");
  return `deleted+${userId}+${rand}@deleted.invalid`;
}

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? "1025");
  const secure = (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
  const from = process.env.SMTP_FROM?.trim() ?? "no-reply@justlovethestocks.local";

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 1025,
    secure,
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS?.trim() || undefined,
    from,
  };
}

async function sendOtpEmail(input: {
  request: FastifyRequest;
  toEmail: string;
  code: string;
}): Promise<void> {
  const smtp = getSmtpConfig();
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (!smtp) {
    if (nodeEnv !== "production") {
      input.request.log.info({ toEmail: input.toEmail, code: input.code }, "otp issued (dev)");
      return;
    }

    throw new AppError({
      code: "SMTP_NOT_CONFIGURED",
      message: "SMTP is not configured",
      statusCode: 500,
    });
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  await transport.sendMail({
    from: smtp.from,
    to: input.toEmail,
    subject: "Your sign-in code",
    text: `Your sign-in code is: ${input.code}\n\nThis code expires soon.`,
  });
}

async function authStartHandler(req: FastifyRequest, reply: FastifyReply) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { email?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!email || !email.includes("@")) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid email",
      statusCode: 400,
    });
  }

  const cfg = getOtpConfig();
  const now = new Date();
  const windowStart = new Date(now.getTime() - cfg.rateWindowSeconds * 1000);

  const recentCount = await prisma.authOtp.count({
    where: {
      email,
      createdAt: { gte: windowStart },
    },
  });

  if (recentCount >= cfg.maxPerWindowPerEmail) {
    return reply.status(429).send({ code: "RATE_LIMITED", message: "Try again later" });
  }

  await prisma.authOtp.updateMany({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });

  const code = generateOtpCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHashHex = sha256Hex(`${salt}:${code}`);
  const expiresAt = new Date(now.getTime() + cfg.ttlSeconds * 1000);

  await prisma.authOtp.create({
    data: {
      email,
      codeSalt: salt,
      codeHashHex,
      expiresAt,
      ipAddress: req.ip,
    },
  });

  await sendOtpEmail({ request: req, toEmail: email, code });

  return reply.status(200).send({ ok: true });
}

function backoffDelaySeconds(input: { attemptCount: number; maxSeconds: number }): number {
  // attemptCount = number of previous failed attempts
  const raw = Math.pow(2, Math.max(0, input.attemptCount - 1));
  return Math.min(raw, input.maxSeconds);
}

async function authVerifyHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const sessionCfg = getSessionConfig();

  const body = req.body as { email?: unknown; code?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email || !email.includes("@") || !code) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid email or code",
      statusCode: 400,
    });
  }

  const cfg = getOtpConfig();
  const now = new Date();

  const otp = await prisma.authOtp.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new AppError({
      code: "OTP_INVALID",
      message: "Invalid code",
      statusCode: 400,
    });
  }

  if (otp.attemptCount >= cfg.maxAttempts) {
    throw new AppError({
      code: "OTP_LOCKED",
      message: "Too many attempts",
      statusCode: 429,
    });
  }

  if (otp.lastAttemptAt) {
    const delaySeconds = backoffDelaySeconds({
      attemptCount: otp.attemptCount,
      maxSeconds: cfg.backoffMaxSeconds,
    });

    const nextAttemptAt = new Date(otp.lastAttemptAt.getTime() + delaySeconds * 1000);
    if (now < nextAttemptAt) {
      throw new AppError({
        code: "OTP_BACKOFF",
        message: "Try again later",
        statusCode: 429,
        details: { retryAfterSeconds: Math.ceil((nextAttemptAt.getTime() - now.getTime()) / 1000) },
      });
    }
  }

  const expectedHashHex = sha256Hex(`${otp.codeSalt}:${code}`);
  const expectedBuf = Buffer.from(otp.codeHashHex, "hex");
  const actualBuf = Buffer.from(expectedHashHex, "hex");

  const match =
    expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!match) {
    const nextAttempts = otp.attemptCount + 1;
    await prisma.authOtp.update({
      where: { id: otp.id },
      data: {
        attemptCount: nextAttempts,
        lastAttemptAt: now,
      },
    });

    if (nextAttempts >= cfg.maxAttempts) {
      throw new AppError({
        code: "OTP_LOCKED",
        message: "Too many attempts",
        statusCode: 429,
      });
    }

    throw new AppError({ code: "OTP_INVALID", message: "Invalid code", statusCode: 400 });
  }

  await prisma.authOtp.update({
    where: { id: otp.id },
    data: {
      consumedAt: now,
      lastAttemptAt: now,
    },
  });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const isNewUser = !existing;

  const user = await prisma.user.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = sha256Hex(refreshToken);
  const refreshExpiresAt = new Date(now.getTime() + sessionCfg.refreshTokenTtlSeconds * 1000);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
    },
  });

  const accessToken = req.server.jwt.sign(
    { sub: user.id, sid: session.id },
    { expiresIn: sessionCfg.accessTokenTtlSeconds },
  );

  return { accessToken, refreshToken, isNewUser };
}

async function authRefreshHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const sessionCfg = getSessionConfig();

  const body = req.body as { refreshToken?: unknown };
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid refresh token",
      statusCode: 400,
    });
  }

  const now = new Date();
  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash: sha256Hex(refreshToken),
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });

  if (!session) {
    throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
  }

  const nextRefreshToken = generateRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: sha256Hex(nextRefreshToken) },
  });

  const accessToken = req.server.jwt.sign(
    { sub: session.userId, sid: session.id },
    { expiresIn: sessionCfg.accessTokenTtlSeconds },
  );

  return { accessToken, refreshToken: nextRefreshToken };
}

async function authLogoutHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { refreshToken?: unknown };
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid refresh token",
      statusCode: 400,
    });
  }

  await prisma.session.updateMany({
    where: { refreshTokenHash: sha256Hex(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { ok: true };
}

async function meHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) {
    throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
  }

  return { id: user.id, email: user.email };
}

async function meDeleteHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const userId = req.user.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
  }

  if (user.deletedAt) {
    return { ok: true };
  }

  const s3 = req.server.s3Exports;
  if (s3) {
    const files = await prisma.exportFile.findMany({
      where: { exportJob: { userId } },
      select: { storageKey: true },
      take: 10_000,
    });

    for (const file of files) {
      try {
        await deleteExportObject({ s3, key: file.storageKey });
      } catch (err) {
        req.log.warn({ err, key: file.storageKey }, "failed to delete export object");
      }
    }
  }

  const deletedAt = new Date();
  const deletedEmail = deletedEmailForUser(userId);
  const originalEmail = user.email;

  await prisma.$transaction(async (tx) => {
    await tx.wheelAuditEvent.deleteMany({ where: { userId } });
    await tx.wheelLeg.deleteMany({ where: { wheelCycle: { userId } } });
    await tx.wheelCycle.deleteMany({ where: { userId } });

    await tx.alertEvent.deleteMany({ where: { alertRule: { userId } } });
    await tx.alertRule.deleteMany({ where: { userId } });

    await tx.exportFile.deleteMany({ where: { exportJob: { userId } } });
    await tx.exportJob.deleteMany({ where: { userId } });

    await tx.tickerPnlDaily.deleteMany({ where: { userId } });
    await tx.tickerPnlTotal.deleteMany({ where: { userId } });

    await tx.transaction.deleteMany({ where: { userId } });
    await tx.positionSnapshot.deleteMany({ where: { account: { userId } } });
    await tx.account.deleteMany({ where: { userId } });

    await tx.syncRun.deleteMany({ where: { userId } });
    await tx.brokerConnection.deleteMany({ where: { userId } });

    await tx.entitlement.deleteMany({ where: { userId } });
    await tx.device.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.userPreferences.deleteMany({ where: { userId } });

    await tx.authOtp.deleteMany({ where: { email: originalEmail } });

    await tx.user.update({
      where: { id: userId },
      data: { deletedAt, email: deletedEmail },
    });
  });

  return { ok: true };
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/start", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          email: { type: "string" },
        },
        required: ["email"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        429: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: authStartHandler,
  });

  app.post("/auth/verify", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          email: { type: "string" },
          code: { type: "string" },
        },
        required: ["email", "code"],
      },
      response: {
        200: { $ref: "AuthVerifyResponse#" },
        400: { $ref: "ProblemDetails#" },
        429: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: authVerifyHandler,
  });

  app.post("/auth/refresh", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          refreshToken: { type: "string" },
        },
        required: ["refreshToken"],
      },
      response: {
        200: { $ref: "AuthTokens#" },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: authRefreshHandler,
  });

  app.post("/auth/logout", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          refreshToken: { type: "string" },
        },
        required: ["refreshToken"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: authLogoutHandler,
  });

  app.get("/me", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: { $ref: "Me#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: meHandler,
  });

  app.delete("/me", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: meDeleteHandler,
  });
}
