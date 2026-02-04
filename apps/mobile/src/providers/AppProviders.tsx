import React, { type PropsWithChildren, useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../query/queryClient';
import { useAuthStore } from '../auth/authStore';
import { useNotificationsStore } from '../notifications/notificationsStore';
import { useDevSettingsStore } from '../dev/devSettingsStore';

export function AppProviders(props: PropsWithChildren) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateNotifications = useNotificationsStore((s) => s.hydrate);
  const hydrateDevSettings = useDevSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateNotifications();
    void hydrateDevSettings();
  }, [hydrate, hydrateNotifications, hydrateDevSettings]);

  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
