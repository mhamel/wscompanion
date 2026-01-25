import createClient from 'openapi-fetch';
import type { paths } from './schema';

export type ApiClient = {
  health(): Promise<{ ok: boolean }>;
};

export function createApiClient(input: { baseUrl: string }): ApiClient {
  const client = createClient<paths>({ baseUrl: input.baseUrl });

  return {
    health: async () => {
      const res = await client.GET('/v1/health');
      if (res.error) {
        throw new Error(res.error.message ?? 'API error');
      }

      // NOTE: `openapi-fetch` may return `data` as undefined if the server returns no body.
      return res.data ?? { ok: false };
    },
  };
}
