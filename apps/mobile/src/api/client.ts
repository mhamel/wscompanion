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

export type ApiClient = {
  health(): Promise<{ ok: boolean }>;
  authStart(input: { email: string }): Promise<{ ok: boolean }>;
  authVerify(input: { email: string; code: string }): Promise<AuthTokens>;
  authRefresh(input: { refreshToken: string }): Promise<AuthTokens>;
  authLogout(input: { refreshToken: string }): Promise<{ ok: boolean }>;
  me(): Promise<{ id: string; email: string }>;
  tickers(input?: { limit?: number }): Promise<TickersResponse>;
  syncStatus(): Promise<SyncStatusResponse>;
  syncConnection(input: { id: string }): Promise<{ syncRunId: string; status: string }>;
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

    tickers: async (input) => {
      const limit = input?.limit ? String(input.limit) : undefined;

      return withAuth((accessToken) =>
        client.GET('/v1/tickers', {
          params: { query: { limit } },
          headers: { Authorization: bearer(accessToken) },
        }),
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
