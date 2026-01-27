import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiClient } from '../api/client';
import { ApiError } from '../api/http';
import { useBillingEntitlementQuery } from '../billing/entitlements';
import { purchasePro, restoreRevenueCatPurchases } from '../billing/revenuecat';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

function formatPlanLabel(plan: 'free' | 'pro' | undefined): string {
  if (plan === 'pro') return 'Pro';
  if (plan === 'free') return 'Gratuit';
  return '…';
}

export function PaywallScreen() {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const queryClient = useQueryClient();

  const entitlementQuery = useBillingEntitlementQuery();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
  });

  const [busy, setBusy] = React.useState<'purchase' | 'restore' | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const plan = entitlementQuery.data?.plan;
  const expiresAt = entitlementQuery.data?.expiresAt;
  const userId = meQuery.data?.id;

  const canUseRevenueCat = Platform.OS !== 'web';

  async function refreshEntitlement() {
    await queryClient.invalidateQueries({ queryKey: ['billingEntitlement'] });
  }

  async function handlePurchase() {
    setBusy('purchase');
    setError(null);
    setInfo(null);

    try {
      const id = userId ?? (await meQuery.refetch()).data?.id;
      if (!id) throw new Error('Impossible de déterminer ton user id (endpoint /v1/me).');

      await purchasePro(id);
      setInfo(
        'Achat effectué. Ton accès Pro peut prendre un court délai à se synchroniser côté serveur.',
      );
      await refreshEntitlement();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Erreur inattendue.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    setBusy('restore');
    setError(null);
    setInfo(null);

    try {
      const id = userId ?? (await meQuery.refetch()).data?.id;
      if (!id) throw new Error('Impossible de déterminer ton user id (endpoint /v1/me).');

      await restoreRevenueCatPurchases(id);
      setInfo('Achats restaurés. Synchronisation en cours…');
      await refreshEntitlement();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Erreur inattendue.');
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Title>Passer Pro</Title>

      <View style={styles.card}>
        <Body>
          Statut: <Body style={{ color: tokens.colors.text }}>{formatPlanLabel(plan)}</Body>
        </Body>
        {expiresAt ? <Body>Expire: {new Date(expiresAt).toLocaleString()}</Body> : null}
        {info ? <Body style={styles.info}>{info}</Body> : null}
        {error ? <Body style={styles.error}>{error}</Body> : null}
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Ce que tu débloques</Title>
        <Body>• P&amp;L 360 illimité</Body>
        <Body>• Wheel tracker</Body>
        <Body>• Alertes + notifications</Body>
        <Body>• Exports “comptable-friendly”</Body>
      </View>

      <View style={styles.card}>
        {!canUseRevenueCat ? (
          <Body style={styles.muted}>
            RevenueCat n’est pas supporté sur web. Utilise iOS/Android.
          </Body>
        ) : null}

        <AppButton
          title={busy === 'purchase' ? 'Achat…' : plan === 'pro' ? 'Déjà Pro' : 'Débloquer Pro'}
          disabled={busy !== null || plan === 'pro' || !canUseRevenueCat}
          onPress={() => void handlePurchase()}
        />
        <AppButton
          title={busy === 'restore' ? 'Restauration…' : 'Restaurer mes achats'}
          variant="secondary"
          disabled={busy !== null || !canUseRevenueCat}
          onPress={() => void handleRestore()}
        />
      </View>
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
  sectionTitle: {
    fontSize: 18,
  },
  error: { color: tokens.colors.negative },
  info: { color: tokens.colors.mutedText },
  muted: { color: tokens.colors.mutedText },
});

