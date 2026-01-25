import React from 'react';
import { Button, SafeAreaView, Text, View } from 'react-native';
import { useAuthStore } from '../auth/authStore';

export function AuthScreen() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>Welcome</Text>
        <Text>OTP login (placeholder)</Text>
        <Button title="Fake sign in" onPress={() => void setAccessToken('demo-token')} />
      </View>
    </SafeAreaView>
  );
}
