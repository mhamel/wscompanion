import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { TickerScreen } from '../screens/TickerScreen';

export type MainStackParamList = {
  Tabs: undefined;
  Ticker: { symbol: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="Ticker"
        component={TickerScreen}
        options={({ route }) => ({ title: route.params.symbol })}
      />
    </Stack.Navigator>
  );
}

