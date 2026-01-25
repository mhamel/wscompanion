import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import nodemailer from "nodemailer";

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
    handler: authVerifyHandler,
  });
}
