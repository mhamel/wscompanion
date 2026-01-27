import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createApiClient, type Money, type WheelCycleDetail, type WheelLeg } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import type { MainStackParamList } from '../navigation/MainStack';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<MainStackParamList, 'WheelCycle'>;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

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

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function LegRow(props: { leg: WheelLeg }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.kind}>{props.leg.kind}</Text>
        {props.leg.pnl ? (
          <Text
            style={[
              styles.money,
              { color: moneyIsNegative(props.leg.pnl.amountMinor) ? tokens.colors.negative : tokens.colors.positive },
            ]}
          >
            {formatMoney(props.leg.pnl)}
          </Text>
        ) : null}
      </View>
      <Body>{formatDateTime(props.leg.occurredAt)}</Body>
      {props.leg.transactionId ? <Body>tx: {props.leg.transactionId}</Body> : null}
      {props.leg.linkedTransactionIds.length ? (
        <Body>linked: {props.leg.linkedTransactionIds.length}</Body>
      ) : null}
    </View>
  );
}

function CycleHeader(props: { cycle: WheelCycleDetail }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Title style={{ fontSize: 20 }}>{props.cycle.symbol}</Title>
        {props.cycle.netPnl ? (
          <Text
            style={[
              styles.net,
              {
                color: moneyIsNegative(props.cycle.netPnl.amountMinor)
                  ? tokens.colors.negative
                  : tokens.colors.positive,
              },
            ]}
          >
            {formatMoney(props.cycle.netPnl)}
          </Text>
        ) : null}
      </View>

      <Body>Status: {props.cycle.status}</Body>
      <Body>
        {formatDateTime(props.cycle.openedAt)}
        {props.cycle.closedAt ? ` → ${formatDateTime(props.cycle.closedAt)}` : ''}
      </Body>
      <Body>Tags: {props.cycle.tags.join(', ') || '—'}</Body>
      {props.cycle.notes ? <Body>Notes: {props.cycle.notes}</Body> : null}

      <Body>
        Premiums: {formatMoney(props.cycle.aggregates.optionPremiums)}
        {props.cycle.aggregates.stockPnl ? ` • Stock P&L: ${formatMoney(props.cycle.aggregates.stockPnl)}` : ''}
      </Body>
    </View>
  );
}

export function WheelCycleDetailScreen({ route }: Props) {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const id = route.params.id;

  const [editing, setEditing] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState('');
  const [tagsDraft, setTagsDraft] = React.useState('');
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const cycleQuery = useQuery({
    queryKey: ['wheelCycle', id],
    queryFn: () => api.wheelCycle({ id }),
  });

  React.useEffect(() => {
    if (!editing) return;
    const cycle = cycleQuery.data;
    if (!cycle) return;
    setNotesDraft(cycle.notes ?? '');
    setTagsDraft(cycle.tags.join(', '));
  }, [editing, cycleQuery.data]);

  async function saveChanges() {
    setSaveBusy(true);
    setSaveError(null);

    try {
      await api.wheelCyclePatch({
        id,
        notes: notesDraft.trim() ? notesDraft.trim() : undefined,
        tags: parseTags(tagsDraft),
      });
      setEditing(false);
      await cycleQuery.refetch();
    } catch (e) {
      if (e instanceof ApiError) {
        setSaveError(e.problem?.message ?? e.message);
      } else {
        setSaveError('Erreur réseau.');
      }
    } finally {
      setSaveBusy(false);
    }
  }

  function confirmSave() {
    Alert.alert('Confirmer', 'Appliquer ces changements ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'OK', onPress: () => void saveChanges() },
    ]);
  }

  return (
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.xs }}>
          <Title>Wheel</Title>
          <Body>Détail d’un cycle</Body>
        </View>

        {cycleQuery.isLoading ? (
          <View style={[styles.card, { marginHorizontal: tokens.spacing.md }]}>
            <Body>Chargement…</Body>
          </View>
        ) : cycleQuery.isError ? (
          <View style={{ gap: tokens.spacing.sm, marginHorizontal: tokens.spacing.md }}>
            <Body style={styles.error}>
              {cycleQuery.error instanceof ApiError
                ? cycleQuery.error.problem?.message ?? cycleQuery.error.message
                : 'Erreur réseau.'}
            </Body>
            <AppButton title="Réessayer" variant="secondary" onPress={() => void cycleQuery.refetch()} />
          </View>
        ) : cycleQuery.data ? (
          <View style={{ gap: tokens.spacing.sm, marginHorizontal: tokens.spacing.md }}>
            <CycleHeader cycle={cycleQuery.data} />

            {editing ? (
              <View style={styles.card}>
                <Title style={{ fontSize: 18 }}>Corriger</Title>
                {saveError ? <Body style={styles.error}>{saveError}</Body> : null}
                <TextField placeholder="Notes" value={notesDraft} onChangeText={setNotesDraft} />
                <TextField placeholder="Tags (séparés par virgules)" value={tagsDraft} onChangeText={setTagsDraft} />

                <View style={styles.buttonsRow}>
                  <AppButton
                    title={saveBusy ? 'Enregistrement…' : 'Enregistrer'}
                    style={{ flex: 1 }}
                    disabled={saveBusy}
                    onPress={confirmSave}
                  />
                  <AppButton
                    title="Annuler"
                    variant="secondary"
                    style={{ flex: 1 }}
                    disabled={saveBusy}
                    onPress={() => setEditing(false)}
                  />
                </View>
              </View>
            ) : (
              <AppButton title="Corriger" variant="secondary" onPress={() => setEditing(true)} />
            )}

            <View style={{ gap: tokens.spacing.sm }}>
              <Title style={{ fontSize: 18 }}>Legs</Title>
              {cycleQuery.data.legs.length === 0 ? (
                <View style={styles.card}>
                  <Body>Aucun leg.</Body>
                </View>
              ) : (
                <View style={{ gap: tokens.spacing.sm }}>
                  {cycleQuery.data.legs.map((leg) => (
                    <Pressable key={leg.id} style={({ pressed }) => (pressed ? styles.pressed : null)}>
                      <LegRow leg={leg} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.card, { marginHorizontal: tokens.spacing.md }]}>
            <Body>Pas de données.</Body>
          </View>
        )}
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
  error: { color: tokens.colors.negative },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  net: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
  kind: { color: tokens.colors.text, fontSize: 16, fontWeight: '600' },
  money: { fontSize: 14, fontWeight: '700', color: tokens.colors.text },
  buttonsRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  pressed: { opacity: 0.85 },
});
