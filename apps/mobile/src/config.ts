export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  apiTimeoutMs: parsePositiveInt(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15_000),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}
