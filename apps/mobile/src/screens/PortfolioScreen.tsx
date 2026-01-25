import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createApiClient } from '../api/client';
import { ApiError } from '../api/http';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

export function PortfolioScreen() {
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
});
