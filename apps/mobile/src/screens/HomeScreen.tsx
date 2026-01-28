import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createApiClient, type SyncStatusItem } from '../api/client';
import { ApiError } from '../api/http';
import { trackWowFirstPnlViewedOnce } from '../analytics/analytics';
import { config } from '../config';
import type { MainTabParamList } from '../navigation/MainTabs';
import { loadSearchHistory, pushSearchHistory, saveSearchHistory } from '../search/history';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';

const QUICK_TABS = ['Trades', 'News', 'Wheel', 'Insights'] as const;

function formatMoney(input: { amountMinor: string; currency: string }): string {
  try {
    const minor = BigInt(input.amountMinor);
    const sign = minor < 0n ? '-' : '';
    const abs = minor < 0n ? -minor : minor;
    const major = abs / 100n;
    const cents = abs % 100n;
    return `${sign}${major.toString()}.${cents.toString().padStart(2, '0')} ${input.currency}`;
  } catch {
    return `${input.amountMinor} ${input.currency}`;
  }
}

function moneyIsNegative(amountMinor: string): boolean {
  try {
    return BigInt(amountMinor) < 0n;
  } catch {
    return false;
  }
}

function formatSyncLabel(item: SyncStatusItem | undefined): string {
  if (!item) return 'Aucune connexion.';

  const run = item.lastRun;
  if (!run) return `Connexion ${item.provider} (${item.status}).`;

  if (run.status === 'queued') return 'Sync en file…';
  if (run.status === 'running') return 'Sync en cours…';
  if (run.status === 'done') return 'Dernière sync: OK';
  if (run.status === 'failed') return `Dernière sync: échec (${run.error ?? 'erreur'})`;

  return `Sync: ${run.status}`;
}

export function HomeScreen() {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [syncBusy, setSyncBusy] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const loaded = await loadSearchHistory();
      if (alive) setHistory(loaded);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const tickersQuery = useQuery({
    queryKey: ['tickers', 100],
    queryFn: () => api.tickers({ limit: 100 }),
  });

  const syncStatusQuery = useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => api.syncStatus(),
  });

  const tickers = tickersQuery.data?.items ?? [];
  const topTickers = tickers.slice(0, 10);
  const activeConnection = syncStatusQuery.data?.items?.find((item) => item.status === 'connected');
  const displayConnection = activeConnection ?? syncStatusQuery.data?.items?.[0];

  React.useEffect(() => {
    if (!tickersQuery.isLoading && !tickersQuery.isError && topTickers.length > 0) {
      void trackWowFirstPnlViewedOnce({ screen: 'home', symbolsCount: topTickers.length });
    }
  }, [tickersQuery.isLoading, tickersQuery.isError, topTickers.length]);

  const totalNet = React.useMemo(() => {
    if (topTickers.length === 0) return null;

    const currency = topTickers[0].pnl.net.currency;
    if (!topTickers.every((i) => i.pnl.net.currency === currency)) return null;

    try {
      let total = 0n;
      for (const item of topTickers) {
        total += BigInt(item.pnl.net.amountMinor);
      }
      return { amountMinor: total.toString(), currency };
    } catch {
      return null;
    }
  }, [topTickers]);

  const queryNorm = query.trim().toUpperCase();
  const exactTicker = queryNorm ? tickers.find((t) => t.symbol === queryNorm) : undefined;
  const suggestions = queryNorm
    ? tickers.filter((t) => t.symbol !== queryNorm && t.symbol.includes(queryNorm)).slice(0, 10)
    : [];

  async function openTicker(symbol: string, tab?: (typeof QUICK_TABS)[number]) {
    const next = pushSearchHistory(history, symbol);
    setHistory(next);
    try {
      await saveSearchHistory(next);
    } catch {
      // ignore persistence errors
    }

    setQuery('');
    (navigation.getParent() as any)?.navigate('Ticker', { symbol, tab });
  }

  async function syncNow() {
    setSyncBusy(true);
    setSyncError(null);

    try {
      const status = syncStatusQuery.data ?? (await syncStatusQuery.refetch()).data;
      const connectionId = status?.items?.find((item) => item.status === 'connected')?.brokerConnectionId;
      if (!connectionId) {
        Alert.alert(
          'Connexion requise',
          'Aucune connexion active. Connecte SnapTrade pour pouvoir synchroniser.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Connexions', onPress: () => (navigation.getParent() as any)?.navigate('Connections') },
          ],
        );
        return;
      }

      await api.syncConnection({ id: connectionId });
      await Promise.all([syncStatusQuery.refetch(), tickersQuery.refetch()]);
    } catch (e) {
      if (e instanceof ApiError) {
        setSyncError(e.problem?.message ?? e.message);
      } else {
        setSyncError('Erreur réseau.');
      }
    } finally {
      setSyncBusy(false);
    }
  }

  const refreshing = syncBusy || tickersQuery.isRefetching || syncStatusQuery.isRefetching;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: tokens.spacing.sm }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void syncNow()} tintColor={tokens.colors.text} />
        }
      >
        <Title>Home</Title>
        <Body>Search-first + top tickers</Body>

        <View style={styles.card}>
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <TextField
                placeholder="Rechercher un ticker (ex: TSLA)"
                autoCapitalize="characters"
                value={query}
                onChangeText={setQuery}
              />
            </View>
            <AppButton
              title="Ask"
              variant="secondary"
              style={{ width: 80 }}
              onPress={() => navigation.navigate('Ask')}
            />
          </View>

          {queryNorm ? (
            <View style={{ gap: tokens.spacing.sm }}>
              {exactTicker ? (
                <View style={{ gap: tokens.spacing.sm }}>
                  <Pressable
                    onPress={() => void openTicker(exactTicker.symbol)}
                    style={({ pressed }) => [styles.suggestionRow, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.symbol}>{exactTicker.symbol}</Text>
                    <Text
                      style={[
                        styles.net,
                        {
                          color: moneyIsNegative(exactTicker.pnl.net.amountMinor)
                            ? tokens.colors.negative
                            : tokens.colors.positive,
                        },
                      ]}
                    >
                      {formatMoney(exactTicker.pnl.net)}
                    </Text>
                  </Pressable>

                  <View style={styles.chipsRow}>
                    {QUICK_TABS.map((tab) => (
                      <Pressable
                        key={tab}
                        onPress={() => void openTicker(exactTicker.symbol, tab)}
                        style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.chipText}>{tab}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {!exactTicker && suggestions.length === 0 ? (
                <Body>Aucun resultat.</Body>
              ) : suggestions.length ? (
                <View style={{ gap: tokens.spacing.xs }}>
                  {suggestions.map((t) => (
                    <Pressable
                      key={t.symbol}
                      onPress={() => void openTicker(t.symbol)}
                      style={({ pressed }) => [styles.suggestionRow, pressed ? styles.pressed : null]}
                    >
                      <Text style={styles.symbol}>{t.symbol}</Text>
                      <Text
                        style={[
                          styles.net,
                          {
                            color: moneyIsNegative(t.pnl.net.amountMinor)
                              ? tokens.colors.negative
                              : tokens.colors.positive,
                          },
                        ]}
                      >
                        {formatMoney(t.pnl.net)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={() => {
                  const q = query.trim();
                  if (!q) return;
                  setQuery('');
                  navigation.navigate('Ask', { q });
                }}
                style={({ pressed }) => [styles.suggestionRow, pressed ? styles.pressed : null]}
              >
                <Text style={styles.symbol}>Ask</Text>
                <Text style={styles.net} numberOfLines={1}>
                  {query.trim()}
                </Text>
              </Pressable>
            </View>
          ) : history.length ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <Body>Historique</Body>
              <View style={styles.chipsRow}>
                {history.map((symbol) => (
                  <Pressable
                    key={symbol}
                    onPress={() => void openTicker(symbol)}
                    style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.chipText}>{symbol}</Text>
                  </Pressable>
                ))}
              </View>
              <AppButton
                title="Effacer l'historique"
                variant="secondary"
                onPress={() => {
                  setHistory([]);
                  void saveSearchHistory([]);
                }}
              />
            </View>
          ) : (
            <Body>Commence par taper un symbole.</Body>
          )}
        </View>

        <View style={styles.card}>
          <Body>{formatSyncLabel(displayConnection)}</Body>
          {syncError ? <Body style={styles.error}>{syncError}</Body> : null}
          {activeConnection ? (
            <AppButton
              title={syncBusy ? 'Sync…' : 'Sync maintenant'}
              variant="secondary"
              disabled={syncBusy || syncStatusQuery.isLoading}
              onPress={() => void syncNow()}
            />
          ) : (
            <AppButton
              title="Connexions"
              variant="secondary"
              disabled={syncBusy || syncStatusQuery.isLoading}
              onPress={() => (navigation.getParent() as any)?.navigate('Connections')}
            />
          )}
        </View>

        {tickersQuery.isLoading ? (
          <View style={{ gap: tokens.spacing.sm }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <View key={idx} style={styles.skeletonCard} />
            ))}
          </View>
        ) : tickersQuery.isError ? (
          <View style={{ gap: tokens.spacing.sm }}>
            <Body style={styles.error}>
              {tickersQuery.error instanceof ApiError
                ? tickersQuery.error.problem?.message ?? tickersQuery.error.message
                : 'Erreur réseau.'}
            </Body>
            <AppButton title="Réessayer" variant="secondary" onPress={() => void tickersQuery.refetch()} />
          </View>
        ) : topTickers.length === 0 ? (
          <View style={{ gap: tokens.spacing.sm }}>
            <Body>Aucune donnée. Tire pour synchroniser, ou connecte un broker.</Body>
            <AppButton
              title="Connecter"
              variant="secondary"
              onPress={() => (navigation.getParent() as any)?.navigate('Connections')}
            />
          </View>
        ) : (
          <View style={{ gap: tokens.spacing.sm }}>
            {totalNet ? (
              <View style={styles.card}>
                <Body>Total net (top {topTickers.length})</Body>
                <Text
                  style={[
                    styles.total,
                    {
                      color: moneyIsNegative(totalNet.amountMinor)
                        ? tokens.colors.negative
                        : tokens.colors.positive,
                    },
                  ]}
                >
                  {formatMoney(totalNet)}
                </Text>
              </View>
            ) : null}

            {topTickers.map((item) => {
              const net = item.pnl.net;
              const neg = moneyIsNegative(net.amountMinor);

              return (
                <Pressable
                  key={item.symbol}
                  onPress={() => void openTicker(item.symbol)}
                  style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
                >
                  <View style={styles.row}>
                    <Text style={styles.symbol}>{item.symbol}</Text>
                    <Text
                      style={[
                        styles.net,
                        { color: neg ? tokens.colors.negative : tokens.colors.positive },
                      ]}
                    >
                      {formatMoney(net)}
                    </Text>
                  </View>
                  <Body>
                    Réalisé {formatMoney(item.pnl.realized)} • Non-réalisé {formatMoney(item.pnl.unrealized)}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  searchRow: { flexDirection: 'row', gap: tokens.spacing.sm, alignItems: 'center' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: 'transparent',
  },
  chipText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symbol: { color: tokens.colors.text, fontSize: 18, fontWeight: '600' },
  net: { fontSize: 16, fontWeight: '600' },
  total: { color: tokens.colors.text, fontSize: 24, fontWeight: '700' },
  error: { color: tokens.colors.negative },
  pressed: { opacity: 0.85 },
  skeletonCard: {
    height: 64,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
    opacity: 0.5,
  },
});
