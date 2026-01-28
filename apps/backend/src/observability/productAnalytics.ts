export const PRODUCT_ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "auth_signup_started",
  "auth_signup_succeeded",
  "auth_login_succeeded",
  "connect_snaptrade_started",
  "connect_snaptrade_completed",
  "connect_snaptrade_failed",
  "sync_initial_started",
  "sync_initial_completed",
  "sync_initial_failed",
  "wow_first_pnl_viewed",
  "paywall_shown",
  "purchase_started",
  "purchase_succeeded",
  "purchase_failed",
  "restore_started",
  "restore_succeeded",
  "restore_failed",
  "entitlement_pro_activated",
] as const;

export type ProductAnalyticsEventName = (typeof PRODUCT_ANALYTICS_EVENT_NAMES)[number];

export function isProductAnalyticsEventName(value: string): value is ProductAnalyticsEventName {
  return (PRODUCT_ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export type ProductAnalyticsLogger = {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

export type TrackProductEventInput = {
  event: ProductAnalyticsEventName;
  distinctId: string;
  properties?: Record<string, unknown>;
};

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function toJsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as unknown;
}

function getPostHogConfig(env: NodeJS.ProcessEnv): { apiKey: string; host: string } | null {
  if (isTruthyFlag(env.ANALYTICS_DISABLED)) return null;

  const apiKey = env.POSTHOG_API_KEY?.trim();
  if (!apiKey) return null;

  const rawHost = env.POSTHOG_HOST?.trim() || "https://app.posthog.com";
  const host = rawHost.replace(/\/+$/, "");
  return { apiKey, host };
}

function getAppEnv(env: NodeJS.ProcessEnv): string {
  const sentry = env.SENTRY_ENVIRONMENT?.trim();
  if (sentry) return sentry;
  return env.NODE_ENV ?? "development";
}

export async function trackProductEvent(
  input: TrackProductEventInput,
  logger?: ProductAnalyticsLogger,
): Promise<void> {
  const cfg = getPostHogConfig(process.env);
  if (!cfg) return;

  const payload = {
    api_key: cfg.apiKey,
    event: input.event,
    distinct_id: input.distinctId,
    properties: {
      app_env: getAppEnv(process.env),
      ...(input.properties ?? {}),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    await fetch(`${cfg.host}/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toJsonSafe(payload)),
      signal: controller.signal,
    });
  } catch (err) {
    logger?.warn?.({ err }, "analytics: posthog capture failed");
  } finally {
    clearTimeout(timeout);
  }
}
