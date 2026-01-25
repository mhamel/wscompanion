import React from 'react';
import { Button, View } from 'react-native';
import { useAuthStore } from '../auth/authStore';
import { Screen } from '../ui/Screen';
import { Body, Title } from '../ui/Typography';

export function AuthScreen() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ gap: 12 }}>
        <Title style={{ fontSize: 24 }}>Welcome</Title>
        <Body>OTP login (placeholder)</Body>
        <Button title="Fake sign in" onPress={() => void setAccessToken('demo-token')} />
      </View>
    </Screen>
  );
}
