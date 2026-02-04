import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const API_BASE_URL_OVERRIDE_KEY = "dev.apiBaseUrlOverride";

type DevSettingsState = {
  hydrated: boolean;
  apiBaseUrlOverride: string | null;
  hydrate: () => Promise<void>;
  setApiBaseUrlOverride: (value: string | null) => Promise<void>;
};

function normalizeBaseUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const withScheme =
    raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`;

  try {
    const u = new URL(withScheme);
    const origin = u.origin;
    return origin.endsWith("/") ? origin.slice(0, -1) : origin;
  } catch {
    return null;
  }
}

export const useDevSettingsStore = create<DevSettingsState>((set) => ({
  hydrated: false,
  apiBaseUrlOverride: null,
  hydrate: async () => {
    const apiBaseUrlOverride = await SecureStore.getItemAsync(API_BASE_URL_OVERRIDE_KEY);
    set({ apiBaseUrlOverride, hydrated: true });
  },
  setApiBaseUrlOverride: async (value) => {
    const normalized = value ? normalizeBaseUrl(value) : null;

    if (normalized) {
      await SecureStore.setItemAsync(API_BASE_URL_OVERRIDE_KEY, normalized);
      set({ apiBaseUrlOverride: normalized });
      return;
    }

    await SecureStore.deleteItemAsync(API_BASE_URL_OVERRIDE_KEY);
    set({ apiBaseUrlOverride: null });
  },
}));

