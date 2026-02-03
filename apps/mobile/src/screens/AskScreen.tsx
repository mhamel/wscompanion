import React from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
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

  const [question, setQuestion] = React.useState(route.params?.q ?? "");
  const [symbol, setSymbol] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AskResponse | null>(null);

  function goPaywall() {
    navigation.navigate("Paywall", { source: "ask" });
  }

  React.useEffect(() => {
    const next = route.params?.q ?? "";
    setQuestion(next);
  }, [route.params?.q]);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.ask({
        question,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
      });
      setResult(res);
    } catch (e) {
      if (isPaywallError(e)) {
        goPaywall();
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
          disabled={busy || !question.trim()}
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
