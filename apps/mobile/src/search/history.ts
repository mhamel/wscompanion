import * as SecureStore from 'expo-secure-store';

const HISTORY_KEY = 'search.history.v1';
const MAX_ITEMS = 10;

export async function loadSearchHistory(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === 'string')) return [];
    return parsed.map((s) => s.trim()).filter(Boolean).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function pushSearchHistory(history: string[], symbol: string): string[] {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return history;

  const next = [normalized, ...history.filter((s) => s !== normalized)].slice(0, MAX_ITEMS);
  return next;
}

export async function saveSearchHistory(history: string[]): Promise<void> {
  const safe = history.map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, MAX_ITEMS);
  await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(safe));
}

