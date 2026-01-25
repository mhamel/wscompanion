import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { createApiClient } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

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

export function HomeScreen() {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);

  const tickersQuery = useQuery({
    queryKey: ['tickers', 10],
    queryFn: () => api.tickers({ limit: 10 }),
  });

  const items = tickersQuery.data?.items ?? [];

  const totalNet = React.useMemo(() => {
    if (items.length === 0) return null;

    const currency = items[0].pnl.net.currency;
    if (!items.every((i) => i.pnl.net.currency === currency)) return null;

    try {
      let total = 0n;
      for (const item of items) {
        total += BigInt(item.pnl.net.amountMinor);
      }
      return { amountMinor: total.toString(), currency };
    } catch {
      return null;
    }
  }, [items]);

  return (
    <Screen>
      <Title>Home</Title>
      <Body>Top tickers P&amp;L</Body>

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
      ) : items.length === 0 ? (
        <Body>Aucune donnée. Connecte ton broker puis lance une sync.</Body>
      ) : (
        <View style={{ gap: tokens.spacing.sm }}>
          {totalNet ? (
            <View style={styles.card}>
              <Body>Total net (top {items.length})</Body>
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

          {items.map((item) => {
            const net = item.pnl.net;
            const neg = moneyIsNegative(net.amountMinor);

            return (
              <View key={item.symbol} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={[styles.net, { color: neg ? tokens.colors.negative : tokens.colors.positive }]}>
                    {formatMoney(net)}
                  </Text>
                </View>
                <Body>
                  Réalisé {formatMoney(item.pnl.realized)} • Non-réalisé {formatMoney(item.pnl.unrealized)}
                </Body>
              </View>
            );
          })}
        </View>
      )}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symbol: { color: tokens.colors.text, fontSize: 18, fontWeight: '600' },
  net: { fontSize: 16, fontWeight: '600' },
  total: { color: tokens.colors.text, fontSize: 24, fontWeight: '700' },
  error: { color: tokens.colors.negative },
  skeletonCard: {
    height: 64,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
    opacity: 0.5,
  },
});
