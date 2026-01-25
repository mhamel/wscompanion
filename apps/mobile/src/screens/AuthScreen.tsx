import React from 'react';
import { Button, SafeAreaView, Text, View } from 'react-native';

export function AuthScreen() {
  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>Welcome</Text>
        <Text>OTP login (placeholder)</Text>
        <Button title="Continue" onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}

