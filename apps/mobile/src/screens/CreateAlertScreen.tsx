import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createApiClient, type AlertTemplate } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import type { MainStackParamList } from '../navigation/MainStack';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateAlert'>;

function TemplateCard(props: { template: AlertTemplate; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <Text style={styles.cardTitle}>{props.template.title}</Text>
      <Body>{props.template.description}</Body>
      <Body>Type: {props.template.type}</Body>
    </Pressable>
  );
}

export function CreateAlertScreen({ navigation }: Props) {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);
  const queryClient = useQueryClient();

  const [selected, setSelected] = React.useState<AlertTemplate | null>(null);
  const [symbol, setSymbol] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [configText, setConfigText] = React.useState('{}');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const templatesQuery = useQuery({
    queryKey: ['alertTemplates'],
    queryFn: () => api.alertTemplates(),
  });

  async function create() {
    if (!selected) return;

    setBusy(true);
    setError(null);

    const symbolNorm = symbol.trim().toUpperCase();
    if (selected.requiresSymbol && !symbolNorm) {
      setBusy(false);
      setError('Symbol requis.');
      return;
    }

    let configObj: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(configText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        configObj = parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }

    if (!configObj) {
      setBusy(false);
      setError('Config invalide (JSON object attendu).');
      return;
    }

    try {
      await api.alertCreate({
        type: selected.type,
        symbol: symbolNorm || undefined,
        config: configObj,
        enabled,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['alertEvents'] }),
      ]);

      Alert.alert('OK', 'Alerte créée.');
      navigation.goBack();
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
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title>Créer une alerte</Title>
          <Body>Choisis un template puis configure.</Body>
        </View>

        {templatesQuery.isLoading ? (
          <View style={[styles.card, { marginHorizontal: tokens.spacing.md }]}>
            <Body>Chargement…</Body>
          </View>
        ) : templatesQuery.isError ? (
          <View style={{ gap: tokens.spacing.sm, marginHorizontal: tokens.spacing.md }}>
            <Body style={styles.error}>
              {templatesQuery.error instanceof ApiError
                ? templatesQuery.error.problem?.message ?? templatesQuery.error.message
                : 'Erreur réseau.'}
            </Body>
            <AppButton
              title="Réessayer"
              variant="secondary"
              onPress={() => void templatesQuery.refetch()}
            />
          </View>
        ) : selected ? (
          <View style={{ gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{selected.title}</Text>
              <Body>{selected.description}</Body>
              <Body>Type: {selected.type}</Body>
            </View>

            {error ? <Body style={styles.error}>{error}</Body> : null}

            {selected.requiresSymbol ? (
              <TextField
                placeholder="Symbol (ex: TSLA)"
                autoCapitalize="characters"
                value={symbol}
                onChangeText={setSymbol}
              />
            ) : null}

            <TextField
              placeholder="Config (JSON)"
              autoCapitalize="none"
              value={configText}
              onChangeText={setConfigText}
              multiline
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />

            <View style={styles.buttonsRow}>
              <AppButton
                title={enabled ? 'Enabled: ON' : 'Enabled: OFF'}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => setEnabled((v) => !v)}
              />
              <AppButton
                title="Changer"
                variant="secondary"
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => setSelected(null)}
              />
            </View>

            <AppButton
              title={busy ? 'Création…' : 'Créer'}
              disabled={busy}
              onPress={() => void create()}
            />
          </View>
        ) : (
          <View style={{ gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md }}>
            {(templatesQuery.data?.items ?? []).map((t) => (
              <TemplateCard
                key={t.type}
                template={t}
                onPress={() => {
                  setSelected(t);
                  setError(null);
                  setSymbol('');
                  setEnabled(true);
                  setConfigText(JSON.stringify(t.defaultConfig));
                }}
              />
            ))}
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
  pressed: { opacity: 0.85 },
  cardTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: '700' },
  error: { color: tokens.colors.negative },
  buttonsRow: { flexDirection: 'row', gap: tokens.spacing.sm },
});
