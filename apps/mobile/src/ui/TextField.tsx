import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { tokens } from '../theme/tokens';

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={tokens.colors.mutedText}
      selectionColor={tokens.colors.primary}
      autoCorrect={false}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 12,
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    color: tokens.colors.text,
    fontSize: 15,
  },
});

