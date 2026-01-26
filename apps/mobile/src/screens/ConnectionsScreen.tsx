import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { createApiClient, type SnaptradeCallbackBody, type SyncStatusItem } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

function parseScopes(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSnaptradeCallbackUrl(url: string, fallbackState: string): SnaptradeCallbackBody | null {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const state = (params.get('state') ?? fallbackState).trim();
    const externalUserId = (params.get('externalUserId') ?? params.get('external_user_id') ?? '').trim();
    const externalConnectionId = (
      params.get('externalConnectionId') ??
      params.get('external_connection_id') ??
      ''
    ).trim();
    const accessToken = (params.get('accessToken') ?? params.get('access_token') ?? '').trim();
    const refreshToken = (params.get('refreshToken') ?? params.get('refresh_token') ?? '').trim();

    const scopesRaw = (params.get('scopes') ?? '').trim();
    const scopes = scopesRaw ? parseScopes(scopesRaw) : undefined;

    if (!state || !externalUserId || !externalConnectionId || !accessToken) return null;

    return {
      state,
      externalUserId,
      externalConnectionId,
      accessToken,
      refreshToken: refreshToken || undefined,
      scopes,
    };
  } catch {
    return null;
  }
}

function formatSyncLabel(item: SyncStatusItem | undefined): string {
  if (!item) return 'Aucune connexion.';
  if (!item.lastRun) return `Connexion ${item.provider} (${item.status}).`;

  const status = item.lastRun.status;
  if (status === 'queued') return 'Sync en file...';
  if (status === 'running') return 'Sync en cours...';
  if (status === 'done') return 'Dernière sync: OK';
  if (status === 'failed') return `Dernière sync: échec (${item.lastRun.error ?? 'erreur'})`;

  return `Sync: ${status}`;
}

export function ConnectionsScreen() {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const syncStatusQuery = useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => api.syncStatus(),
    refetchInterval: (query) => {
      const status = query.state.data?.items?.find((i) => i.status === 'connected')?.lastRun?.status;
      if (status === 'queued' || status === 'running') return 2_000;
      return false;
    },
  });

  const activeConnection = syncStatusQuery.data?.items?.find((item) => item.status === 'connected');
  const displayConnection = activeConnection ?? syncStatusQuery.data?.items?.[0];

  async function connectSnaptrade() {
    setBusy(true);
    setError(null);

    try {
      const start = await api.snaptradeStart();
      const returnUrl = Linking.createURL('snaptrade-callback');

      const result = await WebBrowser.openAuthSessionAsync(start.redirectUrl, returnUrl);
      if (result.type !== 'success' || !result.url) {
        setError('Connexion annulée.');
        return;
      }

      const callbackBody = parseSnaptradeCallbackUrl(result.url, start.state);
      if (!callbackBody) {
        setError('Callback invalide (données manquantes).');
        return;
      }

      await api.snaptradeCallback(callbackBody);
      await syncStatusQuery.refetch();
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

  async function syncNow() {
    const id = activeConnection?.brokerConnectionId;
    if (!id) return;

    setBusy(true);
    setError(null);

    try {
      await api.syncConnection({ id });
      await syncStatusQuery.refetch();
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

  async function disconnect() {
    const id = activeConnection?.brokerConnectionId;
    if (!id) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Déconnecter SnapTrade ?',
        'On va purger les tokens et arrêter la synchronisation. Les données déjà importées restent visibles.',
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Déconnecter', style: 'destructive', onPress: () => resolve(true) },
        ],
      );
    });

    if (!confirmed) return;

    setBusy(true);
    setError(null);

    try {
      await api.connectionDisconnect({ id });
      await syncStatusQuery.refetch();
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
      <Title>Connexions</Title>
      <Body>SnapTrade (lecture seule) - tu peux déconnecter à tout moment.</Body>

      <View style={styles.card}>
        <Title style={{ fontSize: 18 }}>Statut</Title>
        <Body>{formatSyncLabel(displayConnection)}</Body>
        {error ? <Body style={styles.error}>{error}</Body> : null}

        {activeConnection ? (
          <>
            <AppButton
              title={busy ? 'Sync...' : 'Sync maintenant'}
              variant="secondary"
              disabled={busy}
              onPress={() => void syncNow()}
            />
            <AppButton
              title={busy ? 'Déconnexion...' : 'Déconnecter SnapTrade'}
              variant="secondary"
              disabled={busy}
              onPress={() => void disconnect()}
            />
          </>
        ) : (
          <AppButton
            title={busy ? 'Connexion...' : 'Connecter SnapTrade'}
            disabled={busy}
            onPress={() => void connectSnaptrade()}
          />
        )}
      </View>
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
