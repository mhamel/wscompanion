import React, { type PropsWithChildren, useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../query/queryClient';
import { useAuthStore } from '../auth/authStore';

export function AppProviders(props: PropsWithChildren) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
