import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ApiError } from '../api/http';
import { createApiClient } from '../api/client';
import { useAuthStore } from '../auth/authStore';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';

type Step = 'email' | 'code';

function formatAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.problem?.code;
    if (code === 'OTP_INVALID') return 'Code invalide.';
    if (code === 'OTP_LOCKED') return 'Trop de tentatives. Redemande un nouveau code.';
    if (code === 'OTP_BACKOFF') {
      const retryAfter = (error.problem?.details as { retryAfterSeconds?: unknown } | undefined)
        ?.retryAfterSeconds;
      if (typeof retryAfter === 'number') return `Réessaie dans ${retryAfter}s.`;
      return 'Réessaie dans quelques instants.';
    }
    if (code === 'RATE_LIMITED') return 'Trop de demandes. Réessaie plus tard.';

    return error.problem?.message ?? 'Erreur API.';
  }

  return 'Erreur réseau.';
}

export function AuthScreen() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const api = React.useMemo(() => createApiClient({ baseUrl: config.apiBaseUrl }), []);

  const [step, setStep] = React.useState<Step>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const canSendCode = !busy && email.trim().length > 3 && email.includes('@');
  const canVerify = !busy && code.trim().length > 0;

  async function sendCode() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.authStart({ email });
      setStep('code');
      setInfo('Code envoyé. (Dev: vérifier les logs du backend)');
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const tokensRes = await api.authVerify({ email, code });
      await setAccessToken(tokensRes.accessToken);
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ gap: tokens.spacing.md }}>
          <View style={{ gap: tokens.spacing.xs }}>
            <Title style={styles.title}>Connexion</Title>
            <Body>On t’envoie un code par email.</Body>
          </View>

          {step === 'email' ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <TextField
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              {error ? <Body style={styles.error}>{error}</Body> : null}
              {info ? <Body style={styles.info}>{info}</Body> : null}

              <AppButton
                title={busy ? 'Envoi…' : 'Envoyer le code'}
                disabled={!canSendCode}
                onPress={() => void sendCode()}
              />
            </View>
          ) : (
            <View style={{ gap: tokens.spacing.sm }}>
              <Body>Code envoyé à {email.trim()}.</Body>

              <TextField
                placeholder="Code"
                keyboardType="number-pad"
                autoCapitalize="none"
                value={code}
                onChangeText={setCode}
              />

              {error ? <Body style={styles.error}>{error}</Body> : null}
              {info ? <Body style={styles.info}>{info}</Body> : null}

              <AppButton
                title={busy ? 'Vérification…' : 'Valider'}
                disabled={!canVerify}
                onPress={() => void verifyCode()}
              />

              <View style={styles.secondaryRow}>
                <AppButton
                  title="Modifier l’email"
                  variant="secondary"
                  disabled={busy}
                  style={styles.secondaryButton}
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                    setInfo(null);
                  }}
                />

                <AppButton
                  title="Renvoyer"
                  variant="secondary"
                  disabled={busy || !canSendCode}
                  style={styles.secondaryButton}
                  onPress={() => void sendCode()}
                />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26 },
  error: { color: tokens.colors.negative },
  info: { color: tokens.colors.mutedText },
  secondaryRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  secondaryButton: { flex: 1 },
});
