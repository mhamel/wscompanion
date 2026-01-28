import React, { useEffect, useRef } from 'react';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState } from 'react-native';
import { AuthScreen } from '../screens/AuthScreen';
import { MainStack } from './MainStack';
import { useAuthStore } from '../auth/authStore';
import { trackEvent } from '../analytics/analytics';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const lastTrackedAtRef = useRef(0);

  useEffect(() => {
    if (!hydrated || !isAuthed) return;

    const track = (reason: 'startup' | 'foreground') => {
      const now = Date.now();
      if (now - lastTrackedAtRef.current < 5_000) return;
      lastTrackedAtRef.current = now;
      void trackEvent('app_opened', { reason });
    };

    track('startup');

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        track('foreground');
      }
    });

    return () => {
      sub.remove();
    };
  }, [hydrated, isAuthed]);

  if (!hydrated) {
    return null;
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthed ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
