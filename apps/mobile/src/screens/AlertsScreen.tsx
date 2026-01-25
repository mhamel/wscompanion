import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export function AlertsScreen() {
  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '600' }}>Alerts</Text>
        <Text>Rules + recent events (placeholder)</Text>
      </View>
    </SafeAreaView>
  );
}

