import React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { createApiClient, type AlertEvent, type AlertRule } from '../api/client';
import { ApiError } from '../api/http';
import { useBillingEntitlementQuery } from '../billing/entitlements';
import { config } from '../config';
import { useNotificationsStore } from '../notifications/notificationsStore';
import {
  getExpoPushToken,
  getPushPermissionStatus,
  getPushPlatform,
  requestPushPermissions,
} from '../notifications/push';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

export function AlertsScreen() {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const navigation = useNavigation<any>();
  const entitlementQuery = useBillingEntitlementQuery();
  const isPro = entitlementQuery.data?.plan === 'pro';
  const registration = useNotificationsStore((s) => s.registration);
  const setRegistration = useNotificationsStore((s) => s.setRegistration);

  const [pushBusy, setPushBusy] = React.useState(false);
  const [pushError, setPushError] = React.useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = React.useState<
    'unknown' | 'granted' | 'denied' | 'undetermined'
  >('unknown');

  React.useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const status = await getPushPermissionStatus();
        if (alive) setPermissionStatus(status);
      } catch {
        if (alive) setPermissionStatus('unknown');
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function enablePush() {
    const previous = registration;

    setPushBusy(true);
    setPushError(null);

    try {
      const platform = getPushPlatform();
      if (!platform) {
        setPushError('Platform not supported.');
        return;
      }

      const current = await getPushPermissionStatus();
      const next = current === 'granted' ? current : await requestPushPermissions();
      setPermissionStatus(next);

      if (next !== 'granted') {
        setPushError('Notifications permission not granted.');
        return;
      }

      const pushToken = await getExpoPushToken();
      const res = await api.deviceRegister({ pushToken, platform });
      await setRegistration({ deviceId: res.id, pushToken, platform });

      if (previous && previous.pushToken !== pushToken) {
        try {
          await api.deviceDelete({ id: previous.deviceId });
        } catch {
          // ignore cleanup failures
        }
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setPushError(e.problem?.message ?? e.message);
      } else if (e instanceof Error) {
        setPushError(e.message);
      } else {
        setPushError('Unexpected error.');
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError(null);

    try {
      const id = registration?.deviceId;
      if (id) {
        try {
          await api.deviceDelete({ id });
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 404)) {
            throw e;
          }
        }
      }
      await setRegistration(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setPushError(e.problem?.message ?? e.message);
      } else if (e instanceof Error) {
        setPushError(e.message);
      } else {
        setPushError('Unexpected error.');
      }
    } finally {
      setPushBusy(false);
    }
  }

  const rulesQuery = useQuery({
    queryKey: ['alerts', 50],
    queryFn: () => api.alerts({ limit: 50 }),
  });

  const eventsQuery = useInfiniteQuery({
    queryKey: ['alertEvents'],
    queryFn: ({ pageParam }) =>
      api.alertEvents({ cursor: typeof pageParam === 'string' ? pageParam : undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const rules = rulesQuery.data?.items ?? [];
  const events = eventsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function RuleRow(props: { rule: AlertRule }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>{props.rule.type}</Text>
          <Text style={styles.badge}>{props.rule.enabled ? 'ON' : 'OFF'}</Text>
        </View>
        {props.rule.symbol ? <Body>{props.rule.symbol}</Body> : null}
      </View>
    );
  }

  function EventRow(props: { event: AlertEvent }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>{props.event.type}</Text>
          <Body>{formatDateTime(props.event.triggeredAt)}</Body>
        </View>
        {props.event.symbol ? <Body>{props.event.symbol}</Body> : null}
      </View>
    );
  }

  return (
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title>Alerts</Title>
          <AppButton
            title="Créer une alerte"
            onPress={() =>
              isPro
                ? navigation.getParent()?.navigate('CreateAlert')
                : navigation.navigate('Paywall', { source: 'alerts' })
            }
          />
        </View>

        {!isPro ? (
          <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
            <View style={styles.card}>
              <Body>Pro requis: alertes + notifications.</Body>
              <AppButton title="Passer Pro" onPress={() => navigation.navigate('Paywall', { source: 'alerts' })} />
            </View>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title style={{ fontSize: 18 }}>Notifications</Title>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>Push</Text>
              <Switch
                value={Boolean(registration)}
                disabled={pushBusy}
                trackColor={{ false: tokens.colors.border, true: tokens.colors.primary }}
                thumbColor={tokens.colors.text}
                onValueChange={(next) => {
                  if (next) {
                    void enablePush();
                  } else {
                    void disablePush();
                  }
                }}
              />
            </View>
            <Body>Recois tes alertes en notification sur ton tel.</Body>
            {permissionStatus !== 'unknown' ? (
              <Body>Permission: {permissionStatus === 'granted' ? 'OK' : permissionStatus}</Body>
            ) : null}
            {permissionStatus === 'denied' ? (
              <AppButton
                title="Ouvrir les reglages"
                variant="secondary"
                disabled={pushBusy}
                onPress={() => void Linking.openSettings()}
              />
            ) : null}
            {pushError ? <Body style={styles.error}>{pushError}</Body> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title style={{ fontSize: 18 }}>Règles</Title>
          {rulesQuery.isLoading ? (
            <View style={styles.card}>
              <Body>Chargement…</Body>
            </View>
          ) : rulesQuery.isError ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <Body style={styles.error}>
                {rulesQuery.error instanceof ApiError
                  ? rulesQuery.error.problem?.message ?? rulesQuery.error.message
                  : 'Erreur réseau.'}
              </Body>
              <AppButton title="Réessayer" variant="secondary" onPress={() => void rulesQuery.refetch()} />
            </View>
          ) : rules.length === 0 ? (
            <View style={styles.card}>
              <Body>Aucune règle.</Body>
            </View>
          ) : (
            <View style={{ gap: tokens.spacing.sm }}>
              {rules.map((r) => (
                <RuleRow key={r.id} rule={r} />
              ))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title style={{ fontSize: 18 }}>Événements</Title>
          {eventsQuery.isLoading ? (
            <View style={styles.card}>
              <Body>Chargement…</Body>
            </View>
          ) : eventsQuery.isError ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <Body style={styles.error}>
                {eventsQuery.error instanceof ApiError
                  ? eventsQuery.error.problem?.message ?? eventsQuery.error.message
                  : 'Erreur réseau.'}
              </Body>
              <AppButton title="Réessayer" variant="secondary" onPress={() => void eventsQuery.refetch()} />
            </View>
          ) : events.length === 0 ? (
            <View style={styles.card}>
              <Body>Aucun événement.</Body>
            </View>
          ) : (
            <View style={{ gap: tokens.spacing.sm }}>
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}

              {eventsQuery.hasNextPage ? (
                <AppButton
                  title={eventsQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
                  variant="secondary"
                  disabled={eventsQuery.isFetchingNextPage}
                  onPress={() => void eventsQuery.fetchNextPage()}
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
    gap: tokens.spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: tokens.colors.text, fontSize: 16, fontWeight: '600' },
  badge: { color: tokens.colors.mutedText, fontSize: 12, fontWeight: '700' },
  error: { color: tokens.colors.negative },
  pressed: { opacity: 0.85 },
});
