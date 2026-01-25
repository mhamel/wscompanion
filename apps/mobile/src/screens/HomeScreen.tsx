import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../api/client';
import { config } from '../config';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

export function HomeScreen() {
  const api = createApiClient({ baseUrl: config.apiBaseUrl });

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
  });

  return (
    <Screen>
      <Title>Home</Title>
      <Body>Top tickers + time-to-wow (placeholder)</Body>
      <Body>
        API health: {healthQuery.data?.ok ? 'ok' : healthQuery.isLoading ? '...' : 'error'}
      </Body>
    </Screen>
  );
}
