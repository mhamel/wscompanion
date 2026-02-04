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

type AskSource = {
  type: string;
  url?: string;
  title?: string;
  publisher?: string;
  publishedAt?: string;
  symbol?: string;
  count?: number;
};

function isAskSource(value: unknown): value is AskSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === "string";
}

function formatAskSourceLabel(src: AskSource): string {
  if (src.type === "news") return src.publisher?.trim() ? src.publisher.trim() : "News";
  if (src.type === "pnl_total") return "P&L";
  if (src.type === "transactions_count") {
    return typeof src.count === "number" ? `Transactions: ${src.count}` : "Transactions";
  }
  return String(src.type ?? "source");
}

type StoredAskSection = { title: string; bullets: string[]; sources: unknown[] };
type StoredAskResponseData = { answer: string; sections: StoredAskSection[] };

function isStoredAskResponseData(value: unknown): value is StoredAskResponseData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.answer !== "string") return false;
  if (!Array.isArray(obj.sections)) return false;

  return obj.sections.every((s) => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return false;
    const section = s as Record<string, unknown>;
    if (typeof section.title !== "string") return false;
    if (!Array.isArray(section.bullets) || !section.bullets.every((b) => typeof b === "string")) {
      return false;
    }
    if (!Array.isArray(section.sources)) return false;
    return true;
  });
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

  const messagesScrollRef = React.useRef<ScrollView>(null);

  const disclaimerQuery = useQuery({
    queryKey: ["disclaimer"],
    queryFn: () => api.disclaimerGet(),
  });

  const disclaimer = disclaimerQuery.data;
  const disclaimerIsAccepted =
    Boolean(disclaimer?.acceptedAt) && disclaimer?.acceptedVersion === disclaimer?.version;
  const disclaimerNeedsAcceptance = Boolean(disclaimer) && !disclaimerIsAccepted;
  const mustAcceptDisclaimer = disclaimerRequired || disclaimerNeedsAcceptance;

  const threadsQuery = useQuery({
    queryKey: ["askThreads"],
    queryFn: () => api.askThreadsList({ limit: 20 }),
    enabled: isPro && disclaimerIsAccepted,
  });

  const threadQuery = useQuery({
    queryKey: ["askThread", threadId],
    queryFn: () => api.askThreadGet({ id: threadId as string, limit: 50 }),
    enabled: Boolean(threadId) && isPro && disclaimerIsAccepted,
  });

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

  React.useEffect(() => {
    if (!threadId) return;
    const t = setTimeout(() => {
      messagesScrollRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [threadId]);

  React.useEffect(() => {
    if (!threadQuery.data?.items?.length) return;
    const t = setTimeout(() => {
      messagesScrollRef.current?.scrollToEnd({ animated: true });
    }, 0);
    return () => clearTimeout(t);
  }, [threadQuery.data?.items?.length]);

  async function submit() {
    setBusy(true);
    setError(null);
    setDisclaimerRequired(false);

    try {
      const res = await api.ask({
        question,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        threadId: threadId ?? undefined,
      });
      setThreadId(res.threadId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["askThreads"] }),
        queryClient.invalidateQueries({ queryKey: ["askThread", res.threadId] }),
      ]);
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

  async function deleteThread(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.askThreadDelete({ id });
      setThreadId(null);
      await queryClient.invalidateQueries({ queryKey: ["askThreads"] });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.problem?.message ?? e.message);
      } else {
        setError("Erreur réseau.");
      }
    } finally {
      setBusy(false);
    }
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
            setError(null);
          }}
        />
      ) : null}

      {!threadId && threadsQuery.data?.items?.length ? (
        <View style={styles.threadList}>
          <Text style={styles.threadListTitle}>Conversations récentes</Text>
          {threadsQuery.data.items.slice(0, 8).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                setThreadId(t.id);
                setError(null);
              }}
              style={({ pressed }) => [styles.threadRow, pressed ? styles.pressed : null]}
            >
              <View style={styles.threadRowText}>
                <Text style={styles.threadTitle}>{t.title}</Text>
                <Text style={styles.threadMeta}>{t.messageCount} message(s)</Text>
              </View>
              <Text style={styles.threadOpen}>Ouvrir</Text>
            </Pressable>
          ))}
        </View>
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

      {threadId ? (threadQuery.data ? (
        <View style={styles.threadCard}>
          <View style={styles.threadHeader}>
            <Text style={styles.threadHeaderTitle}>
              {threadQuery.data.thread.title}
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert("Supprimer", "Supprimer cette conversation ?", [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: () => void deleteThread(threadId),
                  },
                ])
              }
              disabled={busy || busyDisclaimer}
              style={({ pressed }) => [
                styles.threadDelete,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.threadDeleteText}>Supprimer</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={messagesScrollRef}
            style={styles.threadMessages}
            contentContainerStyle={styles.threadMessagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {threadQuery.data.items
              .slice()
              .reverse()
              .map((m) => {
                const structured =
                  m.role !== "user" && isStoredAskResponseData(m.data) ? m.data : null;

                const createdAtLabel = (() => {
                  const d = new Date(m.createdAt);
                  return Number.isFinite(d.getTime()) ? d.toLocaleString() : null;
                })();

                return (
                  <View
                    key={m.id}
                    style={[
                      styles.messageBubble,
                      m.role === "user"
                        ? styles.messageUser
                        : styles.messageAssistant,
                    ]}
                  >
                    {structured ? (
                      <View>
                        <Text style={styles.answer}>{structured.answer}</Text>
                        {structured.sections.map((s, idx) => (
                          <View key={`${m.id}-sec-${idx}`} style={styles.section}>
                            <Text style={styles.sectionTitle}>{s.title}</Text>
                            {s.bullets.map((b, j) => (
                              <Text key={`${m.id}-${idx}-${j}`} style={styles.bullet}>
                                • {b}
                              </Text>
                            ))}

                            <View style={styles.sources}>
                              {s.sources.filter(isAskSource).map((src, k) => {
                                const label = formatAskSourceLabel(src);
                                const url =
                                  src.type === "news" && typeof src.url === "string"
                                    ? src.url
                                    : null;

                                return url ? (
                                  <Pressable
                                    key={`${m.id}-src-${idx}-${k}`}
                                    onPress={() => Linking.openURL(url)}
                                    style={({ pressed }) => [
                                      styles.sourceChip,
                                      pressed ? styles.pressed : null,
                                    ]}
                                  >
                                    <Text style={styles.sourceText}>{label}</Text>
                                  </Pressable>
                                ) : (
                                  <View key={`${m.id}-src-${idx}-${k}`} style={styles.sourceChip}>
                                    <Text style={styles.sourceText}>{label}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ))}
                        {createdAtLabel ? (
                          <Text style={styles.messageMeta}>{createdAtLabel}</Text>
                        ) : null}
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.messageText}>{m.content}</Text>
                        {createdAtLabel ? (
                          <Text style={styles.messageMeta}>{createdAtLabel}</Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
          </ScrollView>
        </View>
      ) : threadQuery.isLoading ? (
        <View style={styles.threadCard}>
          <Text style={styles.threadMeta}>Chargement...</Text>
        </View>
      ) : null) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

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

    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12, marginTop: 12 },
  error: { color: tokens.colors.negative, marginTop: 12 },
  threadList: {
    marginTop: 12,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  threadListTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: "600" },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  threadRowText: { flex: 1, paddingRight: 12 },
  threadTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: "600" },
  threadMeta: { color: tokens.colors.mutedText, marginTop: 2, fontSize: 12 },
  threadOpen: { color: tokens.colors.primary, fontWeight: "600" },
  notice: {
    marginTop: 12,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  noticeText: { color: tokens.colors.text },
  noticeActions: { gap: 10 },
  threadCard: {
    marginTop: 12,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    flex: 1,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  threadHeaderTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  threadDelete: {
    backgroundColor: tokens.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  threadDeleteText: { color: tokens.colors.negative, fontSize: 12, fontWeight: "600" },
  threadMessages: { flex: 1 },
  threadMessagesContent: { paddingBottom: 8 },
  messageBubble: { borderRadius: 12, padding: 10, marginBottom: 8 },
  messageUser: { backgroundColor: tokens.colors.border, alignSelf: "flex-end" },
  messageAssistant: {
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  messageText: { color: tokens.colors.text },
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
  messageMeta: { color: tokens.colors.mutedText, fontSize: 11, marginTop: 6 },
});
