import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createApiClient, type ExportJob } from '../api/client';
import { ApiError } from '../api/http';
import { useBillingEntitlementQuery } from '../billing/entitlements';
import { isPaywallError } from '../billing/paywall';
import { config } from '../config';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

function ExportRow(props: { job: ExportJob; onShare: () => void; sharing: boolean }) {
  const hasFile = props.job.status === 'succeeded' && Boolean(props.job.file);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{props.job.type}</Text>
        <Text style={styles.badge}>{props.job.status}</Text>
      </View>

      <Body>Cree: {formatDateTime(props.job.createdAt)}</Body>
      {props.job.completedAt ? <Body>Termine: {formatDateTime(props.job.completedAt)}</Body> : null}
      {props.job.error ? <Body style={styles.error}>{props.job.error}</Body> : null}

      {props.job.file ? (
        <Body>
          {props.job.file.fileName} â€¢ {props.job.file.sizeBytes} bytes
        </Body>
      ) : null}

      {hasFile ? (
        <AppButton
          title={props.sharing ? 'Partage...' : 'Partager / telecharger'}
          variant="secondary"
          disabled={props.sharing}
          onPress={props.onShare}
        />
      ) : null}
    </View>
  );
}

export function ExportsScreen() {
  const api = React.useMemo(
    () => createApiClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    [],
  );
  const navigation = useNavigation<any>();
  const entitlementQuery = useBillingEntitlementQuery();
  const isPro = entitlementQuery.data?.plan === 'pro';
  const [year, setYear] = React.useState(() => String(new Date().getFullYear()));
  const [creatingType, setCreatingType] = React.useState<string | null>(null);
  const [sharingId, setSharingId] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);

  const exportsQuery = useInfiniteQuery({
    queryKey: ['exports'],
    queryFn: ({ pageParam }) =>
      api.exportsList({
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
        limit: 20,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: (query) => {
      const items = query.state.data?.pages.flatMap((p) => p.items) ?? [];
      const hasInflight = items.some((j) => j.status === 'queued' || j.status === 'running');
      return hasInflight ? 2_000 : false;
    },
  });

  const jobs = exportsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const hasInflight = jobs.some((j) => j.status === 'queued' || j.status === 'running');

  async function createExport(type: 'pnl_realized_by_ticker' | 'option_premiums_by_year') {
    if (!isPro) {
      navigation.navigate('Paywall');
      return;
    }

    setCreatingType(type);
    setShareError(null);
    try {
      const yearValue = year.trim();
      const params = yearValue ? { year: yearValue } : undefined;
      await api.exportsCreate({ type, format: 'csv', params });
      await exportsQuery.refetch();
    } catch (e) {
      if (isPaywallError(e)) {
        navigation.navigate('Paywall');
        return;
      }

      if (e instanceof ApiError) {
        setShareError(e.problem?.message ?? e.message);
      } else {
        setShareError('Erreur reseau.');
      }
    } finally {
      setCreatingType(null);
    }
  }

  async function shareExport(jobId: string) {
    setSharingId(jobId);
    setShareError(null);
    try {
      const res = await api.exportDownload({ id: jobId });
      await Share.share({ message: res.url });
    } catch (e) {
      if (isPaywallError(e)) {
        navigation.navigate('Paywall');
        return;
      }

      if (e instanceof ApiError) {
        setShareError(e.problem?.message ?? e.message);
      } else {
        setShareError('Erreur reseau.');
      }
    } finally {
      setSharingId(null);
    }
  }

  return (
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title>Exports</Title>
          <Body>Liste des jobs + telechargement (MVP)</Body>
          {shareError ? <Body style={styles.error}>{shareError}</Body> : null}
        </View>

        {!isPro ? (
          <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
            <View style={styles.card}>
              <Body>Pro requis: exports CSV.</Body>
              <AppButton title="Passer Pro" onPress={() => navigation.navigate('Paywall')} />
            </View>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <View style={styles.card}>
            <Body>Preparer mon annee</Body>
            <TextField
              placeholder="Annee (ex: 2025)"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
            />

            <View style={{ gap: tokens.spacing.sm }}>
              <AppButton
                title={creatingType === 'pnl_realized_by_ticker' ? 'Creation...' : 'Realise par ticker (CSV)'}
                disabled={Boolean(creatingType)}
                onPress={() => void createExport('pnl_realized_by_ticker')}
              />
              <AppButton
                title={
                  creatingType === 'option_premiums_by_year'
                    ? 'Creation...'
                    : 'Primes options par annee (CSV)'
                }
                variant="secondary"
                disabled={Boolean(creatingType)}
                onPress={() => void createExport('option_premiums_by_year')}
              />
            </View>

            {hasInflight ? <Body>Jobs en cours...</Body> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          {exportsQuery.isLoading ? (
            <View style={styles.card}>
              <Body>Chargement...</Body>
            </View>
          ) : exportsQuery.isError ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <Body style={styles.error}>
                {exportsQuery.error instanceof ApiError
                  ? exportsQuery.error.problem?.message ?? exportsQuery.error.message
                  : 'Erreur reseau.'}
              </Body>
              <AppButton
                title="Reessayer"
                variant="secondary"
                onPress={() => void exportsQuery.refetch()}
              />
            </View>
          ) : jobs.length === 0 ? (
            <View style={styles.card}>
              <Body>Aucun export.</Body>
            </View>
          ) : (
            <View style={{ gap: tokens.spacing.sm }}>
              {jobs.map((job) => (
                <ExportRow
                  key={job.id}
                  job={job}
                  sharing={sharingId === job.id}
                  onShare={() => void shareExport(job.id)}
                />
              ))}

              {exportsQuery.hasNextPage ? (
                <AppButton
                  title={exportsQuery.isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
                  variant="secondary"
                  disabled={exportsQuery.isFetchingNextPage}
                  onPress={() => void exportsQuery.fetchNextPage()}
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
  badge: { color: tokens.colors.mutedText, fontSize: 13, fontWeight: '600' },
  error: { color: tokens.colors.negative },
});
