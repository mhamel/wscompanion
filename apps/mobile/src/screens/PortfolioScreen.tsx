import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export function PortfolioScreen() {
  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '600' }}>Portfolio</Text>
        <Text>Tickers list + filters (placeholder)</Text>
      </View>
    </SafeAreaView>
  );
}

