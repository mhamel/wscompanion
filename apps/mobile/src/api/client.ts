import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { ApiError } from './http';
import type { ProblemDetails } from './types';

export type ApiClient = {
  health(): Promise<{ ok: boolean }>;
  authStart(input: { email: string }): Promise<{ ok: boolean }>;
  authVerify(input: { email: string; code: string }): Promise<{ accessToken: string; refreshToken: string }>;
};

export function createApiClient(input: { baseUrl: string }): ApiClient {
  const client = createClient<paths>({ baseUrl: input.baseUrl });

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
  };
}
