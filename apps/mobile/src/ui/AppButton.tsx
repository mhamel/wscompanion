import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
};

export function AppButton(props: AppButtonProps) {
  const variant = props.variant ?? 'primary';
  const isDisabled = Boolean(props.disabled);

  return (
    <Pressable
      role="button"
      disabled={isDisabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        props.style,
      ]}
    >
      <Text style={[styles.text, variant === 'primary' ? styles.textPrimary : styles.textSecondary]}>
        {props.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: tokens.colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  textPrimary: {
    color: tokens.colors.background,
  },
  textSecondary: {
    color: tokens.colors.text,
  },
});

