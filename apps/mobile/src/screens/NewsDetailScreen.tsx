import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/MainStack';
import { tokens } from '../theme/tokens';
import { AppButton } from '../ui/AppButton';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

type Props = NativeStackScreenProps<MainStackParamList, 'NewsDetail'>;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

export function NewsDetailScreen({ route, navigation }: Props) {
  const item = route.params.item;
  const meta = [item.publisher, formatDateTime(item.publishedAt)].filter(Boolean).join(' • ');

  return (
    <Screen style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title>{item.title}</Title>
          {meta ? <Body>{meta}</Body> : null}
        </View>

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          {item.summary ? (
            <View style={styles.card}>
              <Body>{item.summary}</Body>
            </View>
          ) : null}

          <AppButton title="Ouvrir l’article" onPress={() => void Linking.openURL(item.url)} />
        </View>

        <View style={{ paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Title style={{ fontSize: 18 }}>Tickers liés</Title>
          {item.symbols.length === 0 ? (
            <Body>—</Body>
          ) : (
            <View style={styles.chipsRow}>
              {item.symbols.map((symbol) => (
                <Pressable
                  key={symbol}
                  onPress={() => navigation.navigate('Ticker', { symbol })}
                  style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.chipText}>{symbol}</Text>
                </Pressable>
              ))}
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
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: 'transparent',
  },
  chipText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});

