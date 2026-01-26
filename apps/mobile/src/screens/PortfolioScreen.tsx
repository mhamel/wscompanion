import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { createApiClient, type SyncStatusItem } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

function formatSyncLabel(item: SyncStatusItem | undefined): string {
  if (!item) return 'Aucune connexion.';
  if (!item.lastRun) return `Connexion ${item.provider} (${item.status}).`;

  const status = item.lastRun.status;
  if (status === 'queued') return 'Sync en file…';
  if (status === 'running') return 'Sync en cours…';
  if (status === 'done') return 'Dernière sync: OK';
  if (status === 'failed') return `Dernière sync: échec (${item.lastRun.error ?? 'erreur'})`;

  return `Sync: ${status}`;
}

export function PortfolioScreen() {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);
  const navigation = useNavigation<any>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const syncStatusQuery = useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => api.syncStatus(),
    refetchInterval: (query) => {
      const active = query.state.data?.items?.find((i) => i.status === 'connected');
      const status = active?.lastRun?.status ?? query.state.data?.items?.[0]?.lastRun?.status;
      if (status === 'queued' || status === 'running') return 2_000;
      return false;
    },
  });

  const activeConnection = syncStatusQuery.data?.items?.find((item) => item.status === 'connected');
  const displayConnection = activeConnection ?? syncStatusQuery.data?.items?.[0];

  async function logout() {
    setBusy(true);
    setError(null);

    try {
      await api.logout();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError('Erreur réseau.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Portfolio</Title>
      <Body>Tickers list + filters (placeholder)</Body>

      <View style={styles.card}>
        <Title style={{ fontSize: 18 }}>Connexion broker</Title>
        <Body>{formatSyncLabel(displayConnection)}</Body>
        <AppButton
          title="Gérer la connexion"
          variant="secondary"
          onPress={() => navigation.getParent()?.navigate('Connections')}
        />

        <AppButton
          title="Exports"
          variant="secondary"
          onPress={() => navigation.getParent()?.navigate('Exports')}
        />
      </View>

      <View style={{ flex: 1 }} />
      {error ? <Body style={styles.error}>{error}</Body> : null}
      <AppButton
        title={busy ? 'Déconnexion…' : 'Se déconnecter'}
        variant="secondary"
        disabled={busy}
        onPress={() => void logout()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tokens.colors.negative },
  card: {
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
});
