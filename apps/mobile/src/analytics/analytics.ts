import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createApiClient } from '../api/client';
import { config } from '../config';

export const ANALYTICS_EVENT_NAMES = [
  'app_opened',
  'auth_signup_started',
  'auth_signup_succeeded',
  'auth_login_succeeded',
  'connect_snaptrade_started',
  'connect_snaptrade_completed',
  'connect_snaptrade_failed',
  'sync_initial_started',
  'sync_initial_completed',
  'sync_initial_failed',
  'wow_first_pnl_viewed',
  'paywall_shown',
  'purchase_started',
  'purchase_succeeded',
  'purchase_failed',
  'restore_started',
  'restore_succeeded',
  'restore_failed',
  'entitlement_pro_activated',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const CONNECT_COMPLETED_AT_KEY = 'analytics.connectCompletedAtMs';
const WOW_FIRST_PNL_SENT_KEY = 'analytics.wowFirstPnlViewedSent';

let apiClient: ReturnType<typeof createApiClient> | null = null;
let wowSentCache: boolean | null = null;
let connectCompletedAtCache: number | null = null;

function getApi() {
  if (!apiClient) {
    apiClient = createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs });
  }
  return apiClient;
}

export async function markConnectCompletedNow(): Promise<void> {
  const now = Date.now();
  connectCompletedAtCache = now;
  try {
    await SecureStore.setItemAsync(CONNECT_COMPLETED_AT_KEY, String(now));
  } catch {
    // ignore persistence errors
  }
}

async function getConnectCompletedAtMs(): Promise<number | null> {
  if (connectCompletedAtCache !== null) return connectCompletedAtCache;
  try {
    const raw = await SecureStore.getItemAsync(CONNECT_COMPLETED_AT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    connectCompletedAtCache = Number.isFinite(n) ? n : null;
    return connectCompletedAtCache;
  } catch {
    return null;
  }
}

export async function trackEvent(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!config.analyticsEnabled) return;

  try {
    const api = getApi();
    await api.analyticsTrack({
      event,
      properties: {
        app_env: config.appEnv,
        platform: Platform.OS,
        ...(properties ?? {}),
      },
    });
  } catch {
    // analytics must never break UX
  }
}

export async function trackWowFirstPnlViewedOnce(input: {
  screen: 'home' | 'ticker';
  symbolsCount: number;
}): Promise<void> {
  if (!config.analyticsEnabled) return;

  if (wowSentCache === true) return;
  if (wowSentCache === null) {
    try {
      const raw = await SecureStore.getItemAsync(WOW_FIRST_PNL_SENT_KEY);
      wowSentCache = raw === '1';
    } catch {
      wowSentCache = false;
    }
  }

  if (wowSentCache) return;

  const connectCompletedAt = await getConnectCompletedAtMs();
  const timeSinceConnectMs = connectCompletedAt ? Math.max(0, Date.now() - connectCompletedAt) : null;

  await trackEvent('wow_first_pnl_viewed', {
    screen: input.screen,
    symbols_count: input.symbolsCount,
    time_since_connect_ms: timeSinceConnectMs,
  });

  wowSentCache = true;
  try {
    await SecureStore.setItemAsync(WOW_FIRST_PNL_SENT_KEY, '1');
  } catch {
    // ignore persistence errors
  }
}
