import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export function HomeScreen() {
  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '600' }}>Home</Text>
        <Text>Top tickers + time-to-wow (placeholder)</Text>
      </View>
    </SafeAreaView>
  );
}

