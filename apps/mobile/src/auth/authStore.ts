import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const ACCESS_TOKEN_KEY = 'auth.accessToken';

type AuthState = {
  hydrated: boolean;
  accessToken: string | null;
  hydrate: () => Promise<void>;
  setAccessToken: (token: string | null) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  accessToken: null,
  hydrate: async () => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    set({ accessToken: token, hydrated: true });
  },
  setAccessToken: async (token) => {
    if (token) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }

    set({ accessToken: token });
  },
}));

