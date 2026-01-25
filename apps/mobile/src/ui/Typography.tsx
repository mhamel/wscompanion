import React, { type PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { tokens } from '../theme/tokens';

type TypographyProps = PropsWithChildren<{
  style?: TextStyle;
}>;

export function Title(props: TypographyProps) {
  return <Text style={[styles.title, props.style]}>{props.children}</Text>;
}

export function Body(props: TypographyProps) {
  return <Text style={[styles.body, props.style]}>{props.children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  body: {
    fontSize: 14,
    color: tokens.colors.mutedText,
  },
});

