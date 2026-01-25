import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export function AskScreen() {
  return (
    <SafeAreaView>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '600' }}>Ask</Text>
        <Text>Perplexity-like Q&A (placeholder)</Text>
      </View>
    </SafeAreaView>
  );
}

