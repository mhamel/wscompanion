import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AskScreen } from '../screens/AskScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';

export type MainTabParamList = {
  Home: undefined;
  Ask: undefined;
  Portfolio: undefined;
  Alerts: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Ask" component={AskScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
    </Tab.Navigator>
  );
}

