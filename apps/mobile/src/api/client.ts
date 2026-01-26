import createClient from 'openapi-fetch';
import { useAuthStore, type AuthTokens } from '../auth/authStore';
import type { paths } from './schema';
import { ApiError } from './http';
import type { ProblemDetails } from './types';

export type Money = {
  amountMinor: string;
  currency: string;
};

export type TickerPnl = {
  net: Money;
  realized: Money;
  unrealized: Money;
  optionPremiums: Money;
  dividends: Money;
  fees: Money;
};

export type TickerListItem = {
  symbol: string;
  pnl: TickerPnl;
  lastUpdatedAt: string;
};

export type TickerPositionSummary = {
  quantity: string;
  avgCost?: Money;
  marketValue?: Money;
};

export type TickerSummaryResponse = {
  symbol: string;
  position?: TickerPositionSummary;
  pnl: TickerPnl;
  lastUpdatedAt: string;
};

export type TickerTimelineItem = {
  date: string;
  net: Money;
  realized: Money;
  unrealized: Money;
  marketValue: Money;
};

export type TickerTimelineResponse = {
  symbol: string;
  baseCurrency: string;
  items: TickerTimelineItem[];
};

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  publishedAt: string;
  symbols: string[];
  summary?: string;
};

export type TickerNewsResponse = {
  items: NewsItem[];
  nextCursor?: string;
};

export type TransactionInstrument = {
  id: string;
  type: string;
  symbol?: string;
  exchange?: string;
  currency: string;
  name?: string;
};

export type TransactionOptionContract = {
  id: string;
  occSymbol: string;
  expiry: string;
  strike: string;
  right: string;
  multiplier: number;
  currency: string;
  underlyingSymbol?: string;
};

export type TransactionItem = {
  id: string;
  accountId: string;
  executedAt: string;
  type: string;
  symbol?: string;
  quantity?: string;
  price?: Money;
  grossAmount?: Money;
  fees?: Money;
  instrument?: TransactionInstrument;
  optionContract?: TransactionOptionContract;
  notes?: string;
};

export type TransactionsResponse = {
  items: TransactionItem[];
  nextCursor?: string;
};

export type WheelDetectResponse = {
  ok: boolean;
  jobId: string;
};

export type WheelCycleSummary = {
  id: string;
  symbol: string;
  status: string;
  openedAt: string;
  closedAt?: string;
  baseCurrency: string;
  netPnl?: Money;
  autoDetected: boolean;
  tags: string[];
  legCount: number;
};

export type WheelCyclesResponse = {
  items: WheelCycleSummary[];
};

export type WheelLeg = {
  id: string;
  kind: string;
  occurredAt: string;
  transactionId?: string;
  linkedTransactionIds: string[];
  pnl?: Money;
};

export type WheelCycleAggregates = {
  optionPremiums: Money;
  stockPnl?: Money;
};

export type WheelCycleDetail = {
  id: string;
  symbol: string;
  status: string;
  openedAt: string;
  closedAt?: string;
  baseCurrency: string;
  netPnl?: Money;
  autoDetected: boolean;
  tags: string[];
  notes?: string;
  aggregates: WheelCycleAggregates;
  legs: WheelLeg[];
};

export type AlertTemplate = {
  type: string;
  title: string;
  description: string;
  requiresSymbol: boolean;
  defaultConfig: Record<string, unknown>;
};

export type AlertRule = {
  id: string;
  type: string;
  symbol?: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
};

export type AlertEvent = {
  id: string;
  alertRuleId: string;
  type: string;
  symbol?: string;
  triggeredAt: string;
  deliveredAt?: string;
  payload: Record<string, unknown>;
};

export type AlertRulesResponse = {
  items: AlertRule[];
};

export type AlertTemplatesResponse = {
  items: AlertTemplate[];
};

export type AlertEventsResponse = {
  items: AlertEvent[];
  nextCursor?: string;
};

export type AlertCreateResponse = {
  ok: boolean;
  id: string;
};

export type TickersResponse = {
  items: TickerListItem[];
};

export type SyncRun = {
  id: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export type SyncStatusItem = {
  brokerConnectionId: string;
  provider: string;
  status: string;
  lastSyncAt?: string;
  lastRun?: SyncRun;
};

export type SyncStatusResponse = {
  items: SyncStatusItem[];
};

export type SnaptradeStartResponse = {
  redirectUrl: string;
  state: string;
};

export type SnaptradeCallbackBody = {
  state: string;
  externalUserId: string;
  externalConnectionId: string;
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
};

export type SnaptradeCallbackResponse = {
  ok: boolean;
  brokerConnectionId: string;
  syncRunId: string;
};

export type ExportJobFile = {
  fileName: string;
  contentType: string;
  sizeBytes: string;
};

export type ExportJob = {
  id: string;
  type: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  file?: ExportJobFile;
};

export type ExportsListResponse = {
  items: ExportJob[];
  nextCursor?: string;
};

export type ExportCreateResponse = {
  exportJobId: string;
  status: string;
};

export type ExportDownloadResponse = {
  url: string;
  expiresAt: string;
};

export type ExportCreateBody = {
  type: 'pnl_realized_by_ticker' | 'option_premiums_by_year';
  format: 'csv';
  params?: Record<string, unknown>;
};

export type ApiClient = {
  health(): Promise<{ ok: boolean }>;
  authStart(input: { email: string }): Promise<{ ok: boolean }>;
  authVerify(input: { email: string; code: string }): Promise<AuthTokens>;
  authRefresh(input: { refreshToken: string }): Promise<AuthTokens>;
  authLogout(input: { refreshToken: string }): Promise<{ ok: boolean }>;
  me(): Promise<{ id: string; email: string }>;
  deviceRegister(input: { pushToken: string; platform: 'ios' | 'android' }): Promise<{ id: string }>;
  deviceDelete(input: { id: string }): Promise<{ ok: boolean }>;
  tickers(input?: { limit?: number }): Promise<TickersResponse>;
  tickerSummary(input: { symbol: string }): Promise<TickerSummaryResponse>;
  tickerNews(input: { symbol: string; cursor?: string; limit?: number }): Promise<TickerNewsResponse>;
  tickerTimeline(input: { symbol: string }): Promise<TickerTimelineResponse>;
  transactions(input: {
    accountId?: string;
    symbol?: string;
    type?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<TransactionsResponse>;
  wheelDetect(input?: { symbol?: string }): Promise<WheelDetectResponse>;
  wheelCycles(input?: { symbol?: string; status?: 'open' | 'closed'; limit?: number }): Promise<WheelCyclesResponse>;
  wheelCycle(input: { id: string }): Promise<WheelCycleDetail>;
  wheelCyclePatch(input: { id: string; notes?: string; tags?: string[] }): Promise<{ ok: boolean }>;
  alertTemplates(): Promise<AlertTemplatesResponse>;
  alerts(input?: { limit?: number }): Promise<AlertRulesResponse>;
  alertEvents(input?: { cursor?: string; limit?: number }): Promise<AlertEventsResponse>;
  alertCreate(input: { type: string; symbol?: string; config: Record<string, unknown>; enabled?: boolean }): Promise<AlertCreateResponse>;
  syncStatus(): Promise<SyncStatusResponse>;
  syncConnection(input: { id: string }): Promise<{ syncRunId: string; status: string }>;
  connectionDisconnect(input: { id: string }): Promise<{ ok: boolean }>;
  snaptradeStart(): Promise<SnaptradeStartResponse>;
  snaptradeCallback(input: SnaptradeCallbackBody): Promise<SnaptradeCallbackResponse>;
  exportsList(input?: { cursor?: string; limit?: number }): Promise<ExportsListResponse>;
  exportsCreate(input: ExportCreateBody): Promise<ExportCreateResponse>;
  exportDownload(input: { id: string }): Promise<ExportDownloadResponse>;
  logout(): Promise<void>;
};

export function createApiClient(input: { baseUrl: string }): ApiClient {
  const client = createClient<paths>({ baseUrl: input.baseUrl });
  let refreshInFlight: Promise<AuthTokens> | null = null;

  function toProblemDetails(error: unknown): ProblemDetails | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const raw = error as { code?: unknown; message?: unknown; details?: unknown };
    if (typeof raw.code !== 'string' || typeof raw.message !== 'string') return undefined;
    return { code: raw.code, message: raw.message, details: raw.details };
  }

  function unwrap<T>(res: { data?: T; error?: unknown; response: Response }, fallback?: T): T {
    if (res.error) {
      const problem = toProblemDetails(res.error);
      throw new ApiError({
        status: res.response.status,
        message: problem?.message ?? 'API error',
        problem,
      });
    }

    if (res.data === undefined) {
      if (fallback !== undefined) return fallback;
      throw new ApiError({
        status: res.response.status,
        message: 'Invalid response from server',
      });
    }

    return res.data;
  }

  function bearer(accessToken: string): string {
    return `Bearer ${accessToken}`;
  }

  async function refreshTokens(): Promise<AuthTokens> {
    if (refreshInFlight) return refreshInFlight;

    const { refreshToken, setTokens } = useAuthStore.getState();
    if (!refreshToken) {
      throw new ApiError({ status: 401, message: 'Not authenticated' });
    }

    refreshInFlight = (async () => {
      try {
        const tokens = unwrap(await client.POST('/v1/auth/refresh', { body: { refreshToken } }));
        await setTokens(tokens);
        return tokens;
      } catch (e) {
        await setTokens(null);
        throw e;
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  async function withAuth<T>(
    makeRequest: (accessToken: string) => Promise<{ data?: T; error?: unknown; response: Response }>,
  ): Promise<T> {
    const { accessToken } = useAuthStore.getState();

    if (!accessToken) {
      const tokens = await refreshTokens();
      const res = await makeRequest(tokens.accessToken);
      return unwrap(res);
    }

    const first = await makeRequest(accessToken);
    if (!first.error) return unwrap(first);
    if (first.response.status !== 401) return unwrap(first);

    const tokens = await refreshTokens();
    const retry = await makeRequest(tokens.accessToken);
    return unwrap(retry);
  }

  return {
    health: async () => {
      const res = await client.GET('/v1/health');
      return unwrap(res, { ok: false });
    },

    authStart: async (body) => {
      const res = await client.POST('/v1/auth/start', { body });
      return unwrap(res);
    },

    authVerify: async (body) => {
      const res = await client.POST('/v1/auth/verify', { body });
      return unwrap(res);
    },

    authRefresh: async (body) => {
      const res = await client.POST('/v1/auth/refresh', { body });
      return unwrap(res);
    },

    authLogout: async (body) => {
      const res = await client.POST('/v1/auth/logout', { body });
      return unwrap(res);
    },

    me: async () => {
      return withAuth((accessToken) =>
        client.GET('/v1/me', { headers: { Authorization: bearer(accessToken) } }),
      );
    },

    deviceRegister: async (body) => {
      return withAuth((accessToken) =>
        client.POST('/v1/devices/register', {
          body,
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    deviceDelete: async (input) => {
      return withAuth((accessToken) =>
        client.DELETE('/v1/devices/{id}', {
          params: { path: { id: input.id } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    tickers: async (input) => {
      const limit = input?.limit ? String(input.limit) : undefined;

      return withAuth((accessToken) =>
        client.GET('/v1/tickers', {
          params: { query: { limit } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    tickerSummary: async (input) => {
      return withAuth((accessToken) =>
        client.GET('/v1/tickers/{symbol}/summary', {
          params: { path: { symbol: input.symbol } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    tickerNews: async (input) => {
      const limit = input.limit ? String(input.limit) : undefined;
      const cursor = input.cursor ? input.cursor : undefined;

      return withAuth((accessToken) =>
        client.GET('/v1/tickers/{symbol}/news', {
          params: { path: { symbol: input.symbol }, query: { limit, cursor } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    tickerTimeline: async (input) => {
      return withAuth((accessToken) =>
        client.GET('/v1/tickers/{symbol}/timeline', {
          params: { path: { symbol: input.symbol } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    transactions: async (input) => {
      return withAuth((accessToken) =>
        client.GET('/v1/transactions', {
          params: {
            query: {
              accountId: input.accountId,
              symbol: input.symbol,
              type: input.type,
              from: input.from,
              to: input.to,
              cursor: input.cursor,
              limit: input.limit,
            },
          },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    wheelDetect: async (input) => {
      const body = input?.symbol ? { symbol: input.symbol } : undefined;
      return withAuth((accessToken) =>
        client.POST('/v1/wheel/detect', {
          body,
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    wheelCycles: async (input) => {
      const limit = input?.limit ? String(input.limit) : undefined;
      return withAuth((accessToken) =>
        client.GET('/v1/wheel/cycles', {
          params: { query: { symbol: input?.symbol, status: input?.status, limit } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    wheelCycle: async (input) => {
      return withAuth((accessToken) =>
        client.GET('/v1/wheel/cycles/{id}', {
          params: { path: { id: input.id } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    wheelCyclePatch: async (input) => {
      return withAuth((accessToken) =>
        client.PATCH('/v1/wheel/cycles/{id}', {
          params: { path: { id: input.id } },
          body: { notes: input.notes, tags: input.tags },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    alertTemplates: async () => {
      return withAuth((accessToken) =>
        client.GET('/v1/alerts/templates', { headers: { Authorization: bearer(accessToken) } }),
      );
    },

    alerts: async (input) => {
      const limit = input?.limit ? String(input.limit) : undefined;
      return withAuth((accessToken) =>
        client.GET('/v1/alerts', {
          params: { query: { limit } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    alertEvents: async (input) => {
      const limit = input?.limit ? String(input.limit) : undefined;
      const cursor = input?.cursor ? input.cursor : undefined;

      return withAuth((accessToken) =>
        client.GET('/v1/alerts/events', {
          params: { query: { limit, cursor } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    alertCreate: async (body) => {
      return withAuth((accessToken) =>
        client.POST('/v1/alerts', { body, headers: { Authorization: bearer(accessToken) } }),
      );
    },

    syncStatus: async () => {
      return withAuth((accessToken) =>
        client.GET('/v1/sync/status', { headers: { Authorization: bearer(accessToken) } }),
      );
    },

    syncConnection: async (input) => {
      return withAuth((accessToken) =>
        client.POST('/v1/connections/{id}/sync', {
          params: { path: { id: input.id } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    connectionDisconnect: async (input) => {
      return withAuth((accessToken) =>
        client.DELETE('/v1/connections/{id}', {
          params: { path: { id: input.id } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    snaptradeStart: async () => {
      return withAuth((accessToken) =>
        client.POST('/v1/connections/snaptrade/start', {
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    snaptradeCallback: async (body) => {
      return withAuth((accessToken) =>
        client.POST('/v1/connections/snaptrade/callback', {
          body,
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    exportsList: async (input) => {
      const limit = input?.limit ? String(input.limit) : undefined;
      const cursor = input?.cursor ? input.cursor : undefined;

      return withAuth((accessToken) =>
        client.GET('/v1/exports', {
          params: { query: { limit, cursor } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    exportsCreate: async (body) => {
      return withAuth((accessToken) =>
        client.POST('/v1/exports', { body, headers: { Authorization: bearer(accessToken) } }),
      );
    },

    exportDownload: async (input) => {
      return withAuth((accessToken) =>
        client.GET('/v1/exports/{id}/download', {
          params: { path: { id: input.id } },
          headers: { Authorization: bearer(accessToken) },
        }),
      );
    },

    logout: async () => {
      const { refreshToken, setTokens } = useAuthStore.getState();

      try {
        if (refreshToken) {
          await unwrap(await client.POST('/v1/auth/logout', { body: { refreshToken } }));
        }
      } finally {
        await setTokens(null);
      }
    },
  };
}
