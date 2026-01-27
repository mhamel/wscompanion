import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../api/client';
import { useAuthStore } from '../auth/authStore';
import { config } from '../config';

export function useBillingEntitlementQuery() {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));

  return useQuery({
    queryKey: ['billingEntitlement'],
    queryFn: () => api.billingEntitlement(),
    enabled: isAuthed,
    staleTime: 60_000,
  });
}

export function useIsPro(): boolean {
  const entitlementQuery = useBillingEntitlementQuery();
  return entitlementQuery.data?.plan === 'pro';
}

