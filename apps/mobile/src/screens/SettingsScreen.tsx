import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createApiClient } from '../api/client';
import { ApiError } from '../api/http';
import { useBillingEntitlementQuery } from '../billing/entitlements';
import { config } from '../config';
import { useAuthStore } from '../auth/authStore';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';

function normalizeCurrency(input: string): string {
  return input.trim().toUpperCase();
}

export function SettingsScreen() {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const entitlementQuery = useBillingEntitlementQuery();

  const [baseCurrency, setBaseCurrency] = React.useState('USD');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const prefsQuery = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.preferencesGet(),
  });

  React.useEffect(() => {
    if (prefsQuery.data?.baseCurrency) {
      setBaseCurrency(prefsQuery.data.baseCurrency);
    }
  }, [prefsQuery.data?.baseCurrency]);

  async function savePreferences() {
    setBusy('prefs');
    setError(null);
    try {
      const next = normalizeCurrency(baseCurrency);
      await api.preferencesPut({ baseCurrency: next });
      await queryClient.invalidateQueries({ queryKey: ['preferences'] });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError('Erreur réseau.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function exportMyData() {
    setBusy('export');
    setError(null);
    try {
      await api.exportsCreate({ type: 'user_data', format: 'json', params: {} });
      navigation.navigate('Exports');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError('Erreur réseau.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy('delete');
    setError(null);

    try {
      await api.meDelete();
      await useAuthStore.getState().setTokens(null);
      await queryClient.clear();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError('Erreur réseau.');
      }
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Supprimer le compte',
      'Cette action supprime tes données (local + serveur). Tu pourras te reconnecter plus tard, mais ce sera un nouveau compte.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  }

  return (
    <Screen>
      <Title>Paramètres</Title>
      {error ? <Body style={styles.error}>{error}</Body> : null}

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Abonnement</Title>
        <Body>
          Statut:{' '}
          {entitlementQuery.data?.plan === 'pro'
            ? 'Pro'
            : entitlementQuery.data
              ? 'Gratuit'
              : '...'}
        </Body>
        <AppButton
          title={entitlementQuery.data?.plan === 'pro' ? 'Gérer Pro' : 'Passer Pro'}
          variant="secondary"
          disabled={busy !== null}
          onPress={() => navigation.navigate('Paywall')}
        />
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Devise</Title>
        <Body>Devise de base utilisée pour P&L (ex: USD, CAD).</Body>
        <TextField
          placeholder="USD"
          value={baseCurrency}
          onChangeText={setBaseCurrency}
          autoCapitalize="characters"
        />
        <AppButton
          title={busy === 'prefs' ? 'Enregistrement…' : 'Enregistrer'}
          disabled={busy !== null || prefsQuery.isLoading}
          onPress={() => void savePreferences()}
        />
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Données</Title>
        <Body>Exporter une copie JSON de tes données.</Body>
        <AppButton
          title={busy === 'export' ? 'Préparation…' : 'Exporter mes données (JSON)'}
          variant="secondary"
          disabled={busy !== null}
          onPress={() => void exportMyData()}
        />
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Confidentialité</Title>
        <AppButton
          title="Connexions SnapTrade"
          variant="secondary"
          disabled={busy !== null}
          onPress={() => navigation.navigate('Connections')}
        />
        <AppButton
          title={busy === 'delete' ? 'Suppression…' : 'Supprimer mon compte'}
          disabled={busy !== null}
          onPress={confirmDelete}
        />
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Support</Title>
        <AppButton
          title="Contacter"
          variant="secondary"
          disabled={busy !== null}
          onPress={() => void Linking.openURL('mailto:support@justlovethestocks.local')}
        />
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
  sectionTitle: {
    fontSize: 18,
  },
});
