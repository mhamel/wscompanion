import React, { type PropsWithChildren } from 'react';
import { Platform, SafeAreaView, StyleSheet, View, type ViewStyle } from 'react-native';
import { config } from '../config';
import { useApiBaseUrl } from '../api/apiHooks';
import { useIsOffline } from '../network/useIsOffline';
import { tokens } from '../theme/tokens';
import { Body } from './Typography';

type ScreenProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    const v = url.toLowerCase();
    return v.includes('localhost') || v.includes('127.0.0.1') || v.includes('::1');
  }
}

export function Screen(props: ScreenProps) {
  const isOffline = useIsOffline();
  const apiBaseUrl = useApiBaseUrl();
  const showApiBaseUrlWarning =
    __DEV__ && Platform.OS !== 'web' && isLocalhostUrl(apiBaseUrl);

  const apiBaseUrlWarningText =
    Platform.OS === 'android'
      ? `API: ${apiBaseUrl} — sur Android emulator, utilise http://10.0.2.2:3000 (et sur device: IP LAN de ton PC).`
      : `API: ${apiBaseUrl} — sur device, utilise l’IP LAN de ton PC (pas localhost).`;

  return (
    <SafeAreaView style={styles.safeArea}>
      {showApiBaseUrlWarning ? (
        <View style={styles.apiBanner}>
          <Body style={styles.apiText}>{apiBaseUrlWarningText}</Body>
        </View>
      ) : null}
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <Body style={styles.offlineText}>Hors ligne — certaines données peuvent être obsolètes.</Body>
        </View>
      ) : null}
      <View style={[styles.container, props.style]}>{props.children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  apiBanner: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  apiText: {
    color: tokens.colors.mutedText,
    textAlign: 'center',
  },
  offlineBanner: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  offlineText: {
    color: tokens.colors.mutedText,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
});
