import React, { type PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../query/queryClient';
import { useAuthStore } from '../auth/authStore';
import { useNotificationsStore } from '../notifications/notificationsStore';
import { useDevSettingsStore } from '../dev/devSettingsStore';

export function AppProviders(props: PropsWithChildren) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const hydrate = useAuthStore((s) => s.hydrate);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrateNotifications = useNotificationsStore((s) => s.hydrate);
  const hydrateDevSettings = useDevSettingsStore((s) => s.hydrate);
  const hadAuthRef = useRef(false);

  useEffect(() => {
    void hydrate();
    void hydrateNotifications();
    void hydrateDevSettings();
  }, [hydrate, hydrateNotifications, hydrateDevSettings]);

  useEffect(() => {
    if (accessToken) {
      hadAuthRef.current = true;
      return;
    }

    if (hadAuthRef.current) {
      hadAuthRef.current = false;
      void queryClient.clear();
    }
  }, [accessToken, queryClient]);

  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
