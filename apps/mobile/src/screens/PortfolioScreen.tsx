import React from 'react';
import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';
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
  if (status === 'queued') return 'Sync en file…';
  if (status === 'running') return 'Sync en cours…';
  if (status === 'done') return 'Dernière sync: OK';
  if (status === 'failed') return `Dernière sync: échec (${item.lastRun.error ?? 'erreur'})`;

  return `Sync: ${status}`;
}

export function PortfolioScreen() {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);
  const [connectBusy, setConnectBusy] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const syncStatusQuery = useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => api.syncStatus(),
    refetchInterval: (query) => {
      const status = query.state.data?.items?.[0]?.lastRun?.status;
      if (status === 'queued' || status === 'running') return 2_000;
      return false;
    },
  });

  const firstConnection = syncStatusQuery.data?.items?.[0];

  async function connectSnaptrade() {
    setConnectBusy(true);
    setConnectError(null);

    try {
      const start = await api.snaptradeStart();
      const returnUrl = Linking.createURL('snaptrade-callback');

      const result = await WebBrowser.openAuthSessionAsync(start.redirectUrl, returnUrl);
      if (result.type !== 'success' || !result.url) {
        setConnectError('Connexion annulée.');
        return;
      }

      const callbackBody = parseSnaptradeCallbackUrl(result.url, start.state);
      if (!callbackBody) {
        setConnectError('Callback invalide (données manquantes).');
        return;
      }

      await api.snaptradeCallback(callbackBody);
      await syncStatusQuery.refetch();
    } catch (e) {
      if (e instanceof ApiError) {
        setConnectError(e.problem?.message ?? e.message);
      } else {
        setConnectError('Erreur réseau.');
      }
    } finally {
      setConnectBusy(false);
    }
  }

  async function syncNow() {
    setConnectBusy(true);
    setConnectError(null);

    try {
      const id = firstConnection?.brokerConnectionId;
      if (!id) return;
      await api.syncConnection({ id });
      await syncStatusQuery.refetch();
    } catch (e) {
      if (e instanceof ApiError) {
        setConnectError(e.problem?.message ?? e.message);
      } else {
        setConnectError('Erreur réseau.');
      }
    } finally {
      setConnectBusy(false);
    }
  }

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
        <Body>{formatSyncLabel(firstConnection)}</Body>
        {connectError ? <Body style={styles.error}>{connectError}</Body> : null}

        {firstConnection ? (
          <AppButton
            title={connectBusy ? 'Sync…' : 'Sync maintenant'}
            variant="secondary"
            disabled={connectBusy}
            onPress={() => void syncNow()}
          />
        ) : (
          <AppButton
            title={connectBusy ? 'Connexion…' : 'Connecter SnapTrade'}
            disabled={connectBusy}
            onPress={() => void connectSnaptrade()}
          />
        )}
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
