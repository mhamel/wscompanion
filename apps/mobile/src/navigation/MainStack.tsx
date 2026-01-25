import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { TickerScreen } from '../screens/TickerScreen';
import { TransactionsFilterScreen } from '../screens/TransactionsFilterScreen';
import { WheelCycleDetailScreen } from '../screens/WheelCycleDetailScreen';
import { NewsDetailScreen } from '../screens/NewsDetailScreen';

export type MainStackParamList = {
  Tabs: undefined;
  Ticker: { symbol: string };
  Transactions: { symbol?: string; type?: string; from?: string; to?: string };
  WheelCycle: { id: string };
  NewsDetail: { item: import('../api/client').NewsItem };
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
      <Stack.Screen name="Transactions" component={TransactionsFilterScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="WheelCycle" component={WheelCycleDetailScreen} options={{ title: 'Wheel' }} />
      <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ title: 'News' }} />
    </Stack.Navigator>
  );
}
