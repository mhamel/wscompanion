import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../api/apiHooks';
import { useAuthStore } from '../auth/authStore';

export function useBillingEntitlementQuery() {
  const api = useApiClient();
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
