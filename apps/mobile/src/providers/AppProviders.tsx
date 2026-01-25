import React, { type PropsWithChildren, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../query/queryClient';

export function AppProviders(props: PropsWithChildren) {
  const queryClient = useMemo(() => createQueryClient(), []);

  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}

