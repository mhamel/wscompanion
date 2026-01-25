import { apiFetch } from './http';
import { HealthResponse } from './types';

export type ApiClient = {
  health(): Promise<HealthResponse>;
};

export function createApiClient(input: { baseUrl: string }): ApiClient {
  return {
    health: () =>
      apiFetch<HealthResponse>({
        baseUrl: input.baseUrl,
        path: '/v1/health',
      }),
  };
}

