import React from "react";
import { config } from "../config";
import { useDevSettingsStore } from "../dev/devSettingsStore";
import { createApiClient } from "./client";

export function getEffectiveApiBaseUrl(): string {
  if (!__DEV__) return config.apiBaseUrl;
  const override = useDevSettingsStore.getState().apiBaseUrlOverride;
  return override?.trim() ? override.trim() : config.apiBaseUrl;
}

export function useApiBaseUrl(): string {
  const hydrated = useDevSettingsStore((s) => s.hydrated);
  const override = useDevSettingsStore((s) => s.apiBaseUrlOverride);

  if (!__DEV__) return config.apiBaseUrl;
  if (!hydrated) return config.apiBaseUrl;
  return override?.trim() ? override.trim() : config.apiBaseUrl;
}

export function useApiClient() {
  const baseUrl = useApiBaseUrl();
  return React.useMemo(
    () => createApiClient({ baseUrl, timeoutMs: config.apiTimeoutMs }),
    [baseUrl],
  );
}

