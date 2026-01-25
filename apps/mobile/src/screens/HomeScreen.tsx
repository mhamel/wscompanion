import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView, Text, View } from 'react-native';
import { createApiClient } from '../api/client';
import { config } from '../config';

export function HomeScreen() {
  const api = createApiClient({ baseUrl: config.apiBaseUrl });

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
  });

  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '600' }}>Home</Text>
        <Text>Top tickers + time-to-wow (placeholder)</Text>
        <Text>API health: {healthQuery.data?.ok ? 'ok' : healthQuery.isLoading ? '...' : 'error'}</Text>
      </View>
    </SafeAreaView>
  );
}
