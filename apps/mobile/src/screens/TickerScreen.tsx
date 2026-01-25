import React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createApiClient, type Money, type NewsItem, type TickerSummaryResponse } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';
import type { MainStackParamList } from '../navigation/MainStack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<MainStackParamList, 'Ticker'>;

type Tab = 'Trades' | 'News' | 'Wheel' | 'Insights';

function moneyIsNegative(amountMinor: string): boolean {
  try {
    return BigInt(amountMinor) < 0n;
  } catch {
    return false;
  }
}

function formatMoney(input: Money): string {
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

function TabButton(props: { label: Tab; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.tab,
        props.active ? styles.tabActive : styles.tabInactive,
        pressed ? styles.tabPressed : null,
      ]}
    >
      <Text style={[styles.tabText, props.active ? styles.tabTextActive : styles.tabTextInactive]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function SummaryCard(props: { summary: TickerSummaryResponse }) {
  const net = props.summary.pnl.net;
  const neg = moneyIsNegative(net.amountMinor);

  return (
    <View style={styles.card}>
      <Body>P&amp;L net</Body>
      <Text style={[styles.net, { color: neg ? tokens.colors.negative : tokens.colors.positive }]}>
        {formatMoney(net)}
      </Text>

      <Body>
        Réalisé {formatMoney(props.summary.pnl.realized)} • Non-réalisé{' '}
        {formatMoney(props.summary.pnl.unrealized)}
      </Body>

      {props.summary.position ? (
        <View style={{ gap: tokens.spacing.xs }}>
          <Body>Position</Body>
          <Body>Quantité: {props.summary.position.quantity}</Body>
          {props.summary.position.avgCost ? (
            <Body>PRU: {formatMoney(props.summary.position.avgCost)}</Body>
          ) : null}
          {props.summary.position.marketValue ? (
            <Body>Valeur: {formatMoney(props.summary.position.marketValue)}</Body>
          ) : null}
        </View>
      ) : (
        <Body>Aucune position détectée.</Body>
      )}
    </View>
  );
}

function NewsRow(props: { item: NewsItem }) {
  const meta = [props.item.publisher, formatDateTime(props.item.publishedAt)]
    .filter(Boolean)
    .join(' • ');

  return (
    <Pressable
      onPress={() => void Linking.openURL(props.item.url)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <Text style={styles.newsTitle}>{props.item.title}</Text>
      {meta ? <Body>{meta}</Body> : null}
      {props.item.summary ? <Body>{props.item.summary}</Body> : null}
    </Pressable>
  );
}

export function TickerScreen({ route }: Props) {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);
  const symbol = route.params.symbol;
  const [tab, setTab] = React.useState<Tab>('Trades');

  const summaryQuery = useQuery({
    queryKey: ['tickerSummary', symbol],
    queryFn: () => api.tickerSummary({ symbol }),
  });

  const newsQuery = useInfiniteQuery({
    queryKey: ['tickerNews', symbol],
    queryFn: ({ pageParam }) =>
      api.tickerNews({ symbol, cursor: typeof pageParam === 'string' ? pageParam : undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: tab === 'News',
  });

  const newsItems = newsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.xs }}>
          <Title>{symbol}</Title>
          <Body>Summary + tabs (MVP)</Body>
        </View>

        {summaryQuery.isLoading ? (
          <View style={[styles.card, { marginHorizontal: tokens.spacing.md }]}>
            <Body>Chargement…</Body>
          </View>
        ) : summaryQuery.isError ? (
          <View style={{ gap: tokens.spacing.sm, marginHorizontal: tokens.spacing.md }}>
            <Body style={styles.error}>
              {summaryQuery.error instanceof ApiError
                ? summaryQuery.error.problem?.message ?? summaryQuery.error.message
                : 'Erreur réseau.'}
            </Body>
            <AppButton
              title="Réessayer"
              variant="secondary"
              onPress={() => void summaryQuery.refetch()}
            />
          </View>
        ) : (
          <View style={{ marginHorizontal: tokens.spacing.md }}>
            {summaryQuery.data ? <SummaryCard summary={summaryQuery.data} /> : <Body>Pas de données.</Body>}
          </View>
        )}

        <View style={styles.tabsRow}>
          <TabButton label="Trades" active={tab === 'Trades'} onPress={() => setTab('Trades')} />
          <TabButton label="News" active={tab === 'News'} onPress={() => setTab('News')} />
          <TabButton label="Wheel" active={tab === 'Wheel'} onPress={() => setTab('Wheel')} />
          <TabButton label="Insights" active={tab === 'Insights'} onPress={() => setTab('Insights')} />
        </View>

        <View style={{ marginHorizontal: tokens.spacing.md }}>
          {tab === 'Trades' ? (
            <View style={styles.card}>
              <Body>Trades (à venir: FE-042)</Body>
            </View>
          ) : tab === 'News' ? (
            <View style={{ gap: tokens.spacing.sm }}>
              {newsQuery.isLoading ? (
                <View style={styles.card}>
                  <Body>Chargement…</Body>
                </View>
              ) : newsQuery.isError ? (
                <View style={{ gap: tokens.spacing.sm }}>
                  <Body style={styles.error}>
                    {newsQuery.error instanceof ApiError
                      ? newsQuery.error.problem?.message ?? newsQuery.error.message
                      : 'Erreur réseau.'}
                  </Body>
                  <AppButton
                    title="Réessayer"
                    variant="secondary"
                    onPress={() => void newsQuery.refetch()}
                  />
                </View>
              ) : newsItems.length === 0 ? (
                <View style={styles.card}>
                  <Body>Aucune news pour ce ticker.</Body>
                </View>
              ) : (
                <View style={{ gap: tokens.spacing.sm }}>
                  {newsItems.map((item) => (
                    <NewsRow key={item.id} item={item} />
                  ))}

                  {newsQuery.hasNextPage ? (
                    <AppButton
                      title={newsQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
                      variant="secondary"
                      disabled={newsQuery.isFetchingNextPage}
                      onPress={() => void newsQuery.fetchNextPage()}
                    />
                  ) : null}
                </View>
              )}
            </View>
          ) : tab === 'Wheel' ? (
            <View style={styles.card}>
              <Body>Wheel (à venir: FE-050)</Body>
            </View>
          ) : (
            <View style={styles.card}>
              <Body>Insights (à venir)</Body>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  card: {
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  net: { fontSize: 28, fontWeight: '700', color: tokens.colors.text },
  error: { color: tokens.colors.negative },
  pressed: { opacity: 0.85 },
  tabsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: tokens.colors.primary,
  },
  tabInactive: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: 'transparent',
  },
  tabPressed: { opacity: 0.85 },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: tokens.colors.background },
  tabTextInactive: { color: tokens.colors.text },
  newsTitle: { color: tokens.colors.text, fontSize: 15, fontWeight: '600' },
});
