import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useApiBaseUrl, useApiClient } from "../api/apiHooks";
import { ApiError } from "../api/http";
import { useBillingEntitlementQuery } from "../billing/entitlements";
import { config } from "../config";
import { useAuthStore } from "../auth/authStore";
import { resetAnalyticsLocalState } from "../analytics/analytics";
import { useDevSettingsStore } from "../dev/devSettingsStore";
import { useNotificationsStore } from "../notifications/notificationsStore";
import { clearSearchHistory } from "../search/history";
import { tokens } from "../theme/tokens";
import { AppButton } from "../ui/AppButton";
import { Screen } from "../ui/Screen";
import { TextField } from "../ui/TextField";
import { Body, Title } from "../ui/Typography";

function normalizeCurrency(input: string): string {
  return input.trim().toUpperCase();
}

export function SettingsScreen() {
  const api = useApiClient();
  const apiBaseUrl = useApiBaseUrl();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const entitlementQuery = useBillingEntitlementQuery();
  const setTokens = useAuthStore((s) => s.setTokens);
  const registration = useNotificationsStore((s) => s.registration);
  const setRegistration = useNotificationsStore((s) => s.setRegistration);

  const [baseCurrency, setBaseCurrency] = React.useState("USD");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [apiBaseUrlInput, setApiBaseUrlInput] = React.useState("");

  const apiBaseUrlOverride = useDevSettingsStore((s) => s.apiBaseUrlOverride);
  const setApiBaseUrlOverride = useDevSettingsStore((s) => s.setApiBaseUrlOverride);

  React.useEffect(() => {
    setApiBaseUrlInput(apiBaseUrlOverride ?? "");
  }, [apiBaseUrlOverride]);

  async function applyApiBaseUrlOverride(next: string | null) {
    try {
      await setApiBaseUrlOverride(next);
      await queryClient.clear();
      setApiBaseUrlInput(next ?? "");
      Alert.alert("OK", next ? `API baseUrl mis à jour.\n\n${next}` : "API baseUrl reset.");
    } catch {
      setError("Impossible d’enregistrer ce baseUrl.");
    }
  }

  async function fetchForDiagnostics(url: string) {
    const startedAt = Date.now();
    const res = await fetch(url);
    const text = await res.text();
    const ms = Date.now() - startedAt;

    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // ignore
    }

    return { res, text, body, ms };
  }

  async function runApiDiagnostics() {
    const base = apiBaseUrl.replace(/\/+$/, "");
    const targets = [
      { name: "/v1/health", url: `${base}/v1/health` },
      { name: "/v1/ready", url: `${base}/v1/ready` },
      { name: "/v1/version", url: `${base}/v1/version` },
    ];

    const lines: string[] = [`Base URL: ${base}`];
    for (const t of targets) {
      const r = await fetchForDiagnostics(t.url);
      const statusLine = `${t.name}: ${r.res.status} ${r.res.ok ? "OK" : "ERROR"} (${r.ms}ms)`;

      if (t.name === "/v1/version" && r.body && typeof r.body === "object") {
        const obj = r.body as Record<string, unknown>;
        const nodeEnv = typeof obj.nodeEnv === "string" ? obj.nodeEnv : null;
        const gitSha = typeof obj.gitSha === "string" ? obj.gitSha : null;
        const release = typeof obj.release === "string" ? obj.release : null;
        const meta = [nodeEnv, gitSha, release].filter((v): v is string => Boolean(v)).join(" / ");
        const details = meta ? `\n  ${meta}` : "";
        const snippet =
          !r.res.ok && r.body
            ? `\n  ${(
                typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2)
              ).slice(0, 400)}`
            : "";
        lines.push(`${statusLine}${details}${snippet}`);
        continue;
      }

      if (t.name === "/v1/ready" && r.body && typeof r.body === "object") {
        const obj = r.body as Record<string, unknown>;
        const checks = obj.checks && typeof obj.checks === "object" ? (obj.checks as Record<string, unknown>) : null;
        const meta = checks
          ? Object.entries(checks)
              .map(([k, v]) => {
                if (v && typeof v === "object") {
                  const ok = (v as Record<string, unknown>).ok;
                  return `${k}:${ok === true ? "ok" : ok === false ? "fail" : "?"}`;
                }
                return `${k}:?`;
              })
              .join(", ")
          : "";
        const snippet =
          !r.res.ok && r.body
            ? `\n  ${(
                typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2)
              ).slice(0, 400)}`
            : "";
        lines.push(meta ? `${statusLine}\n  ${meta}${snippet}` : `${statusLine}${snippet}`);
        continue;
      }

      if (!r.res.ok && r.body) {
        lines.push(
          `${statusLine}\n  ${(
            typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2)
          ).slice(0, 400)}`,
        );
      } else {
        lines.push(statusLine);
      }
    }

    Alert.alert("API diagnostics", lines.join("\n"));
  }

  const prefsQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api.preferencesGet(),
  });

  const disclaimerQuery = useQuery({
    queryKey: ["disclaimer"],
    queryFn: () => api.disclaimerGet(),
  });

  const disclaimer = disclaimerQuery.data;
  const disclaimerIsAccepted =
    Boolean(disclaimer?.acceptedAt) && disclaimer?.acceptedVersion === disclaimer?.version;
  const disclaimerNeedsAcceptance = Boolean(disclaimer) && !disclaimerIsAccepted;

  React.useEffect(() => {
    if (prefsQuery.data?.baseCurrency) {
      setBaseCurrency(prefsQuery.data.baseCurrency);
    }
  }, [prefsQuery.data?.baseCurrency]);

  async function savePreferences() {
    setBusy("prefs");
    setError(null);
    try {
      const next = normalizeCurrency(baseCurrency);
      await api.preferencesPut({ baseCurrency: next });
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function exportMyData() {
    setBusy("export");
    setError(null);
    try {
      await api.exportsCreate({
        type: "user_data",
        format: "json",
        params: {},
      });
      navigation.navigate("Exports");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    setError(null);

    try {
      await api.meDelete();
      await useAuthStore.getState().setTokens(null);
      await queryClient.clear();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusy(null);
    }
  }

  function showDisclaimer() {
    const text = disclaimerQuery.data?.text ?? "...";
    Alert.alert("Avertissement", text);
  }

  async function acceptDisclaimer() {
    setBusy("disclaimer");
    setError(null);
    try {
      await api.disclaimerAccept();
      await queryClient.invalidateQueries({ queryKey: ["disclaimer"] });
      Alert.alert("OK", "Avertissement enregistré.");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Supprimer le compte",
      "Cette action supprime tes données (local + serveur). Tu pourras te reconnecter plus tard, mais ce sera un nouveau compte.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => void deleteAccount(),
        },
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
          Statut:{" "}
          {entitlementQuery.data?.plan === "pro"
            ? "Pro"
            : entitlementQuery.data
              ? "Gratuit"
              : "..."}
        </Body>
        <AppButton
          title={
            entitlementQuery.data?.plan === "pro" ? "Gérer Pro" : "Passer Pro"
          }
          variant="secondary"
          disabled={busy !== null}
          onPress={() => navigation.navigate("Paywall", { source: "settings" })}
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
          title={busy === "prefs" ? "Enregistrement…" : "Enregistrer"}
          disabled={busy !== null || prefsQuery.isLoading}
          onPress={() => void savePreferences()}
        />
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Données</Title>
        <Body>Exporter une copie JSON de tes données.</Body>
        <AppButton
          title={
            busy === "export" ? "Préparation…" : "Exporter mes données (JSON)"
          }
          variant="secondary"
          disabled={busy !== null}
          onPress={() => void exportMyData()}
        />
      </View>

      <View style={styles.card}>
        <Title style={styles.sectionTitle}>Confidentialité</Title>
        <Body>
          Avertissement:{" "}
          {disclaimerQuery.isLoading
            ? "..."
            : disclaimerIsAccepted
              ? `accepté (v${disclaimer?.version ?? "?"})`
              : disclaimerQuery.data?.acceptedAt
                ? `à revalider (v${disclaimer?.acceptedVersion ?? "?"} → v${disclaimer?.version ?? "?"})`
                : "non accepté"}
        </Body>
        <AppButton
          title="Lire l’avertissement"
          variant="secondary"
          disabled={busy !== null || disclaimerQuery.isLoading}
          onPress={showDisclaimer}
        />
        <AppButton
          title={
            busy === "disclaimer"
              ? "Enregistrement…"
              : disclaimerIsAccepted
                ? "Accepté"
                : disclaimerQuery.data?.acceptedAt
                  ? "Ré-accepter"
                  : "Accepter"
          }
          variant="secondary"
          disabled={
            busy !== null ||
            disclaimerQuery.isLoading ||
            (Boolean(disclaimerQuery.data) && !disclaimerNeedsAcceptance)
          }
          onPress={() => void acceptDisclaimer()}
        />
        <AppButton
          title="Connexions SnapTrade"
          variant="secondary"
          disabled={busy !== null}
          onPress={() => navigation.navigate("Connections")}
        />
        <AppButton
          title={busy === "delete" ? "Suppression…" : "Supprimer mon compte"}
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
          onPress={() =>
            void Linking.openURL("mailto:support@justlovethestocks.local")
          }
        />
      </View>

      {__DEV__ ? (
        <View style={styles.card}>
          <Title style={styles.sectionTitle}>Dev</Title>
          <Body>API: {apiBaseUrl}</Body>
          <Body>Env: {config.appEnv}</Body>
          <TextField
            placeholder="Override API baseUrl (ex: http://10.0.2.2:3000)"
            value={apiBaseUrlInput}
            onChangeText={setApiBaseUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <AppButton
                title={busy === "api_preset_android" ? "…" : "Preset Android (10.0.2.2)"}
                variant="secondary"
                disabled={busy !== null}
                onPress={() => {
                  setBusy("api_preset_android");
                  setError(null);
                  void (async () => {
                    try {
                      await applyApiBaseUrlOverride("http://10.0.2.2:3000");
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
              />
            </View>
            <View style={styles.rowItem}>
              <AppButton
                title={busy === "api_preset_localhost" ? "…" : "Preset localhost"}
                variant="secondary"
                disabled={busy !== null}
                onPress={() => {
                  setBusy("api_preset_localhost");
                  setError(null);
                  void (async () => {
                    try {
                      await applyApiBaseUrlOverride("http://localhost:3000");
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <AppButton
                title={busy === "api_apply" ? "…" : "Appliquer"}
                variant="secondary"
                disabled={busy !== null}
                onPress={() => {
                  setBusy("api_apply");
                  setError(null);
                  void (async () => {
                    try {
                      await applyApiBaseUrlOverride(apiBaseUrlInput);
                    } catch {
                      // handled by helper
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
              />
            </View>
            <View style={styles.rowItem}>
              <AppButton
                title={busy === "api_reset" ? "…" : "Reset"}
                variant="secondary"
                disabled={busy !== null}
                onPress={() => {
                  setBusy("api_reset");
                  setError(null);
                  void (async () => {
                    try {
                      await applyApiBaseUrlOverride(null);
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
              />
            </View>
          </View>
          <AppButton
            title={busy === "api_diag" ? "Test…" : "Diagnostics API (health + ready + version)"}
            variant="secondary"
            disabled={busy !== null}
            onPress={() => {
              setBusy("api_diag");
              setError(null);

              void (async () => {
                try {
                  await runApiDiagnostics();
                } catch {
                  setError(
                    "Impossible de joindre l’API. Vérifie EXPO_PUBLIC_API_BASE_URL (10.0.2.2 sur Android emulator / IP LAN sur device).",
                  );
                } finally {
                  setBusy(null);
                }
              })();
            }}
          />
          <AppButton
            title={busy === "api_test" ? "Test…" : "Tester /v1/health"}
            variant="secondary"
            disabled={busy !== null}
            onPress={() => {
              setBusy("api_test");
              setError(null);

              void (async () => {
                try {
                  const url = `${apiBaseUrl.replace(/\/+$/, "")}/v1/health`;
                  const res = await fetch(url);
                  const text = await res.text();
                  Alert.alert("API", `${res.status} ${res.ok ? "OK" : "ERROR"}\n\n${text.slice(0, 400)}`);
                } catch {
                  setError(
                    "Impossible de joindre l’API. Vérifie EXPO_PUBLIC_API_BASE_URL (10.0.2.2 sur Android emulator / IP LAN sur device).",
                  );
                } finally {
                  setBusy(null);
                }
              })();
            }}
          />
          <AppButton
            title={busy === "api_ready" ? "Test…" : "Tester /v1/ready"}
            variant="secondary"
            disabled={busy !== null}
            onPress={() => {
              setBusy("api_ready");
              setError(null);

              void (async () => {
                try {
                  const url = `${apiBaseUrl.replace(/\/+$/, "")}/v1/ready`;
                  const res = await fetch(url);
                  const text = await res.text();

                  let body: unknown = text;
                  try {
                    body = JSON.parse(text);
                  } catch {
                    // ignore
                  }

                  const msg =
                    typeof body === "string"
                      ? body.slice(0, 400)
                      : JSON.stringify(body, null, 2).slice(0, 800);

                  Alert.alert("API", `${res.status} ${res.ok ? "READY" : "NOT READY"}\n\n${msg}`);
                } catch {
                  setError(
                    "Impossible de joindre l’API. Vérifie EXPO_PUBLIC_API_BASE_URL (10.0.2.2 sur Android emulator / IP LAN sur device).",
                  );
                } finally {
                  setBusy(null);
                }
              })();
            }}
          />
          <AppButton
            title={busy === "api_version" ? "Test…" : "Tester /v1/version"}
            variant="secondary"
            disabled={busy !== null}
            onPress={() => {
              setBusy("api_version");
              setError(null);

              void (async () => {
                try {
                  const url = `${apiBaseUrl.replace(/\/+$/, "")}/v1/version`;
                  const res = await fetch(url);
                  const text = await res.text();

                  let body: unknown = text;
                  try {
                    body = JSON.parse(text);
                  } catch {
                    // ignore
                  }

                  const msg =
                    typeof body === "string"
                      ? body.slice(0, 400)
                      : JSON.stringify(body, null, 2).slice(0, 800);

                  Alert.alert("API", `${res.status} ${res.ok ? "OK" : "ERROR"}\n\n${msg}`);
                } catch {
                  setError(
                    "Impossible de joindre l’API. Vérifie EXPO_PUBLIC_API_BASE_URL (10.0.2.2 sur Android emulator / IP LAN sur device).",
                  );
                } finally {
                  setBusy(null);
                }
              })();
            }}
          />
          <AppButton
            title="Ouvrir /v1/health"
            variant="secondary"
            disabled={busy !== null}
            onPress={() => void Linking.openURL(`${apiBaseUrl.replace(/\/+$/, "")}/v1/health`)}
          />
          <AppButton
            title="Ouvrir /v1/ready"
            variant="secondary"
            disabled={busy !== null}
            onPress={() => void Linking.openURL(`${apiBaseUrl.replace(/\/+$/, "")}/v1/ready`)}
          />
          <AppButton
            title="Ouvrir /v1/version"
            variant="secondary"
            disabled={busy !== null}
            onPress={() => void Linking.openURL(`${apiBaseUrl.replace(/\/+$/, "")}/v1/version`)}
          />

          <AppButton
            title={busy === "dev_reset" ? "Reset…" : "Reset local state (dev)"}
            variant="secondary"
            disabled={busy !== null}
            onPress={() =>
              Alert.alert(
                "Reset local state",
                "Cette action efface les données locales (tokens auth, override API, notifications, analytics flags, historique de recherche).",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Reset",
                    style: "destructive",
                    onPress: () => {
                      setBusy("dev_reset");
                      setError(null);

                      void (async () => {
                        try {
                          if (registration?.deviceId) {
                            try {
                              await api.deviceDelete({ id: registration.deviceId });
                            } catch {
                              // ignore server cleanup failures
                            }
                          }

                          await Promise.all([
                            setRegistration(null),
                            setTokens(null),
                            setApiBaseUrlOverride(null),
                            resetAnalyticsLocalState(),
                            clearSearchHistory(),
                          ]);

                          await queryClient.clear();
                          Alert.alert("OK", "Local state reset.");
                        } catch {
                          setError("Échec du reset local.");
                        } finally {
                          setBusy(null);
                        }
                      })();
                    },
                  },
                ],
              )
            }
          />
        </View>
      ) : null}
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
  row: { flexDirection: "row", gap: 10 },
  rowItem: { flex: 1 },
});
