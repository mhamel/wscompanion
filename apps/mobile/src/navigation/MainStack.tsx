import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { TickerScreen } from '../screens/TickerScreen';
import { TransactionsFilterScreen } from '../screens/TransactionsFilterScreen';
import { WheelCycleDetailScreen } from '../screens/WheelCycleDetailScreen';
import { NewsDetailScreen } from '../screens/NewsDetailScreen';
import { CreateAlertScreen } from '../screens/CreateAlertScreen';
import { ExportsScreen } from '../screens/ExportsScreen';
import { ConnectionsScreen } from '../screens/ConnectionsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type MainStackParamList = {
  Tabs: undefined;
  Ticker: { symbol: string; tab?: 'Trades' | 'News' | 'Wheel' | 'Insights' };
  Transactions: { symbol?: string; type?: string; from?: string; to?: string };
  WheelCycle: { id: string };
  NewsDetail: { item: import('../api/client').NewsItem };
  CreateAlert: undefined;
  Exports: undefined;
  Connections: undefined;
  Settings: undefined;
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
      <Stack.Screen name="Exports" component={ExportsScreen} options={{ title: 'Exports' }} />
      <Stack.Screen name="Connections" component={ConnectionsScreen} options={{ title: 'Connexions' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Paramètres' }} />
      <Stack.Screen name="CreateAlert" component={CreateAlertScreen} options={{ title: 'Créer une alerte' }} />
    </Stack.Navigator>
  );
}
