import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createApiClient, type AskResponse } from "../api/client";
import { ApiError } from "../api/http";
import { useBillingEntitlementQuery } from "../billing/entitlements";
import { isPaywallError } from "../billing/paywall";
import { config } from "../config";
import { isDisclaimerRequiredError } from "../disclaimer/disclaimer";
import type { MainTabParamList } from "../navigation/MainTabs";
import type { MainStackParamList } from "../navigation/MainStack";
import { tokens } from "../theme/tokens";
import { AppButton } from "../ui/AppButton";
import { Screen } from "../ui/Screen";
import { TextField } from "../ui/TextField";
import { Body, Title } from "../ui/Typography";

type Props = BottomTabScreenProps<MainTabParamList, "Ask">;

type AskSource = { type: string; url?: string };

function isAskSource(value: unknown): value is AskSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === "string";
}

export function AskScreen({ route }: Props) {
  const api = React.useMemo(
    () =>
      createApiClient({
        baseUrl: config.apiBaseUrl,
        timeoutMs: config.apiTimeoutMs,
      }),
    [],
  );

  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const entitlementQuery = useBillingEntitlementQuery();
  const isPro = entitlementQuery.data?.plan === "pro";

  const queryClient = useQueryClient();

  const [question, setQuestion] = React.useState(route.params?.q ?? "");
  const [symbol, setSymbol] = React.useState("");
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyDisclaimer, setBusyDisclaimer] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [disclaimerRequired, setDisclaimerRequired] = React.useState(false);
  const [result, setResult] = React.useState<AskResponse | null>(null);

  const disclaimerQuery = useQuery({
    queryKey: ["disclaimer"],
    queryFn: () => api.disclaimerGet(),
  });

  const disclaimer = disclaimerQuery.data;
  const disclaimerIsAccepted =
    Boolean(disclaimer?.acceptedAt) && disclaimer?.acceptedVersion === disclaimer?.version;
  const disclaimerNeedsAcceptance = Boolean(disclaimer) && !disclaimerIsAccepted;
  const mustAcceptDisclaimer = disclaimerRequired || disclaimerNeedsAcceptance;

  function goPaywall() {
    navigation.navigate("Paywall", { source: "ask" });
  }

  function showDisclaimer() {
    Alert.alert("Avertissement", disclaimer?.text ?? "...");
  }

  async function acceptDisclaimer() {
    setBusyDisclaimer(true);
    setError(null);

    try {
      await api.disclaimerAccept();
      await queryClient.invalidateQueries({ queryKey: ["disclaimer"] });
      setDisclaimerRequired(false);
      Alert.alert("OK", "Avertissement enregistré.");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusyDisclaimer(false);
    }
  }

  React.useEffect(() => {
    const next = route.params?.q ?? "";
    setQuestion(next);
  }, [route.params?.q]);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    setDisclaimerRequired(false);

    try {
      const res = await api.ask({
        question,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        threadId: threadId ?? undefined,
      });
      setResult(res);
      setThreadId(res.threadId);
    } catch (e) {
      if (isPaywallError(e)) {
        goPaywall();
        return;
      }
      if (isDisclaimerRequiredError(e)) {
        setDisclaimerRequired(true);
        void queryClient.invalidateQueries({ queryKey: ["disclaimer"] });
        return;
      }
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (entitlementQuery.data && !isPro) {
    return (
      <Screen>
        <Title>Ask (Pro)</Title>
        <Body>Ask est une fonctionnalité Pro.</Body>
        <AppButton title="Passer Pro" onPress={goPaywall} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Ask</Title>
      <Body>
        Pose une question sur un ticker (P&amp;L, activité, news) — sans conseil
        financier.
      </Body>

      {threadId ? (
        <AppButton
          title="Nouvelle conversation"
          variant="secondary"
          disabled={busy || busyDisclaimer}
          onPress={() => {
            setThreadId(null);
            setResult(null);
            setError(null);
          }}
        />
      ) : null}

      {mustAcceptDisclaimer ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Pour utiliser Ask, tu dois accepter (ou ré-accepter) l’avertissement
            “pas de conseil financier”.
          </Text>
          <View style={styles.noticeActions}>
            <AppButton
              title="Lire"
              variant="secondary"
              disabled={busy || busyDisclaimer || disclaimerQuery.isLoading}
              onPress={showDisclaimer}
            />
            <AppButton
              title={
                busyDisclaimer
                  ? "..."
                  : disclaimer?.acceptedAt && !disclaimerIsAccepted
                    ? "Ré-accepter"
                    : "Accepter"
              }
              variant="secondary"
              disabled={busy || busyDisclaimer || disclaimerQuery.isLoading}
              onPress={() => void acceptDisclaimer()}
            />
          </View>
          <AppButton
            title="Aller aux Paramètres"
            variant="secondary"
            disabled={busy || busyDisclaimer}
            onPress={() => navigation.navigate("Settings")}
          />
        </View>
      ) : null}

      <View style={styles.fields}>
        <TextField
          placeholder="Question (ex: Pourquoi AAPL a chuté?)"
          value={question}
          onChangeText={setQuestion}
        />
        <TextField
          placeholder="Ticker (optionnel) ex: AAPL"
          value={symbol}
          onChangeText={setSymbol}
        />
        <AppButton
          title={busy ? "..." : "Demander"}
          onPress={submit}
          disabled={busy || busyDisclaimer || mustAcceptDisclaimer || !question.trim()}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result ? (
        <ScrollView contentContainerStyle={styles.result}>
          <Text style={styles.answer}>{result.answer}</Text>
          {result.sections.map((s, idx) => (
            <View key={`${s.title}-${idx}`} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              {s.bullets.map((b, j) => (
                <Text key={`${idx}-${j}`} style={styles.bullet}>
                  • {b}
                </Text>
              ))}

              <View style={styles.sources}>
                {s.sources.filter(isAskSource).map((src, k) => {
                  if (src.type === "news" && typeof src.url === "string") {
                    const url = src.url;
                    return (
                      <Pressable
                        key={`${idx}-src-${k}`}
                        onPress={() => Linking.openURL(url)}
                        style={({ pressed }) => [
                          styles.sourceChip,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text style={styles.sourceText}>Source</Text>
                      </Pressable>
                    );
                  }

                  return (
                    <View key={`${idx}-src-${k}`} style={styles.sourceChip}>
                      <Text style={styles.sourceText}>
                        {String(src.type ?? "source")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12, marginTop: 12 },
  error: { color: tokens.colors.negative, marginTop: 12 },
  notice: {
    marginTop: 12,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  noticeText: { color: tokens.colors.text },
  noticeActions: { gap: 10 },
  result: { paddingBottom: 40, gap: 16, marginTop: 16 },
  answer: { color: tokens.colors.text, fontSize: 16 },
  section: {
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    padding: 12,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  bullet: { color: tokens.colors.mutedText, marginBottom: 4 },
  sources: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  sourceChip: {
    backgroundColor: tokens.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pressed: { opacity: 0.85 },
  sourceText: { color: tokens.colors.mutedText, fontSize: 12 },
});
