export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  apiTimeoutMs: parsePositiveInt(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15_000),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  analyticsEnabled: parseBoolean(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED, false),
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}
