import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const DEVICE_ID_KEY = 'notifications.deviceId';
const PUSH_TOKEN_KEY = 'notifications.pushToken';
const PLATFORM_KEY = 'notifications.platform';

export type PushPlatform = 'ios' | 'android';

type NotificationRegistration = {
  deviceId: string;
  pushToken: string;
  platform: PushPlatform;
};

type NotificationsState = {
  hydrated: boolean;
  registration: NotificationRegistration | null;
  hydrate: () => Promise<void>;
  setRegistration: (registration: NotificationRegistration | null) => Promise<void>;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  hydrated: false,
  registration: null,

  hydrate: async () => {
    const [deviceId, pushToken, platformRaw] = await Promise.all([
      SecureStore.getItemAsync(DEVICE_ID_KEY),
      SecureStore.getItemAsync(PUSH_TOKEN_KEY),
      SecureStore.getItemAsync(PLATFORM_KEY),
    ]);

    const platform = platformRaw === 'ios' || platformRaw === 'android' ? platformRaw : null;

    set({
      hydrated: true,
      registration:
        deviceId && pushToken && platform
          ? { deviceId, pushToken, platform }
          : null,
    });
  },

  setRegistration: async (registration) => {
    if (registration) {
      await Promise.all([
        SecureStore.setItemAsync(DEVICE_ID_KEY, registration.deviceId),
        SecureStore.setItemAsync(PUSH_TOKEN_KEY, registration.pushToken),
        SecureStore.setItemAsync(PLATFORM_KEY, registration.platform),
      ]);

      set({ registration });
      return;
    }

    await Promise.all([
      SecureStore.deleteItemAsync(DEVICE_ID_KEY),
      SecureStore.deleteItemAsync(PUSH_TOKEN_KEY),
      SecureStore.deleteItemAsync(PLATFORM_KEY),
    ]);

    set({ registration: null });
  },
}));

