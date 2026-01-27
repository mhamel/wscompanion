import React, { type PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useIsOffline } from '../network/useIsOffline';
import { tokens } from '../theme/tokens';
import { Body } from './Typography';

type ScreenProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Screen(props: ScreenProps) {
  const isOffline = useIsOffline();

  return (
    <SafeAreaView style={styles.safeArea}>
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
