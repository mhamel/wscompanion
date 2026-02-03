import type { FastifyRequest } from "fastify";
import { enforceRateLimit, getRequestRateLimitStore, hashRateLimitKeyPart } from "../rateLimit";

type AskQuotaConfig = { windowSeconds: number; max: number };

function parseIntEnv(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function getAskQuotaConfig(): AskQuotaConfig {
  const windowSeconds = parseIntEnv("ASK_RATE_WINDOW_SECONDS") ?? 86_400;
  const max = parseIntEnv("ASK_RATE_MAX") ?? 200;

  return {
    windowSeconds: windowSeconds > 0 ? windowSeconds : 86_400,
    max: max > 0 ? max : 200,
  };
}

export async function enforceAskQuota(req: FastifyRequest): Promise<void> {
  const cfg = getAskQuotaConfig();
  const store = getRequestRateLimitStore(req.server.redis ?? null);
  const key = `ask:quota:${hashRateLimitKeyPart(req.user.sub)}`;

  await enforceRateLimit({
    store,
    key,
    max: cfg.max,
    windowSeconds: cfg.windowSeconds,
    code: "ASK_RATE_LIMITED",
    message: "Too many Ask requests",
  });
}
