import React, { type PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

type ScreenProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Screen(props: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, props.style]}>{props.children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  container: {
    flex: 1,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
});

