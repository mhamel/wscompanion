import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { createApiClient, type Money, type TransactionItem } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import type { MainStackParamList } from '../navigation/MainStack';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<MainStackParamList, 'Transactions'>;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
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

function buildShareText(tx: TransactionItem): string {
  const parts = [
    formatDateTime(tx.executedAt),
    tx.type,
    tx.symbol ?? tx.instrument?.symbol ?? tx.optionContract?.underlyingSymbol ?? '',
    tx.optionContract ? tx.optionContract.occSymbol : '',
    tx.quantity ? `qty ${tx.quantity}` : '',
    tx.grossAmount ? `gross ${formatMoney(tx.grossAmount)}` : '',
    tx.fees ? `fees ${formatMoney(tx.fees)}` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}

function TxRow(props: { tx: TransactionItem }) {
  const symbol = props.tx.symbol ?? props.tx.instrument?.symbol ?? props.tx.optionContract?.underlyingSymbol;
  const gross = props.tx.grossAmount ? formatMoney(props.tx.grossAmount) : null;

  return (
    <Pressable
      onPress={() => void Share.share({ message: buildShareText(props.tx) })}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.row}>
        <Text style={styles.symbol}>{symbol ?? '—'}</Text>
        {gross ? <Text style={styles.money}>{gross}</Text> : null}
      </View>
      <Body>
        {formatDateTime(props.tx.executedAt)} • {props.tx.type}
      </Body>
      {props.tx.optionContract ? <Body>{props.tx.optionContract.occSymbol}</Body> : null}
      {props.tx.notes ? <Body>{props.tx.notes}</Body> : null}
    </Pressable>
  );
}

export function TransactionsFilterScreen({ route }: Props) {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);

  const [draftSymbol, setDraftSymbol] = React.useState(route.params.symbol ?? '');
  const [draftType, setDraftType] = React.useState('');
  const [draftFrom, setDraftFrom] = React.useState('');
  const [draftTo, setDraftTo] = React.useState('');

  const [symbol, setSymbol] = React.useState(route.params.symbol ?? '');
  const [type, setType] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  const txQuery = useInfiniteQuery({
    queryKey: ['transactions', symbol, type, from, to],
    queryFn: ({ pageParam }) =>
      api.transactions({
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        type: type.trim() ? type.trim() : undefined,
        from: from.trim() ? from.trim() : undefined,
        to: to.trim() ? to.trim() : undefined,
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = txQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.xs }}>
          <Title>Transactions</Title>
          <Body>Filtres (symbol/type/date) • Appuie sur une ligne pour partager</Body>
        </View>

        <View style={[styles.card, { marginHorizontal: tokens.spacing.md }]}>
          <TextField
            placeholder="Symbol (ex: TSLA)"
            autoCapitalize="characters"
            value={draftSymbol}
            onChangeText={setDraftSymbol}
          />
          <TextField placeholder="Type (ex: buy)" value={draftType} onChangeText={setDraftType} />
          <TextField
            placeholder="From (date-time)"
            autoCapitalize="none"
            value={draftFrom}
            onChangeText={setDraftFrom}
          />
          <TextField
            placeholder="To (date-time)"
            autoCapitalize="none"
            value={draftTo}
            onChangeText={setDraftTo}
          />

          <View style={styles.buttonsRow}>
            <AppButton
              title="Appliquer"
              style={{ flex: 1 }}
              onPress={() => {
                setSymbol(draftSymbol);
                setType(draftType);
                setFrom(draftFrom);
                setTo(draftTo);
              }}
            />
            <AppButton
              title="Reset"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setDraftSymbol(route.params.symbol ?? '');
                setDraftType('');
                setDraftFrom('');
                setDraftTo('');
                setSymbol(route.params.symbol ?? '');
                setType('');
                setFrom('');
                setTo('');
              }}
            />
          </View>
        </View>

        <View style={{ marginHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          {txQuery.isLoading ? (
            <View style={styles.card}>
              <Body>Chargement…</Body>
            </View>
          ) : txQuery.isError ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <Body style={styles.error}>
                {txQuery.error instanceof ApiError
                  ? txQuery.error.problem?.message ?? txQuery.error.message
                  : 'Erreur réseau.'}
              </Body>
              <AppButton title="Réessayer" variant="secondary" onPress={() => void txQuery.refetch()} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.card}>
              <Body>Aucune transaction.</Body>
            </View>
          ) : (
            <View style={{ gap: tokens.spacing.sm }}>
              {items.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}

              {txQuery.hasNextPage ? (
                <AppButton
                  title={txQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
                  variant="secondary"
                  disabled={txQuery.isFetchingNextPage}
                  onPress={() => void txQuery.fetchNextPage()}
                />
              ) : null}
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
    gap: tokens.spacing.sm,
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symbol: { color: tokens.colors.text, fontSize: 16, fontWeight: '600' },
  money: { color: tokens.colors.text, fontSize: 14, fontWeight: '600' },
  error: { color: tokens.colors.negative },
  buttonsRow: { flexDirection: 'row', gap: tokens.spacing.sm },
});

