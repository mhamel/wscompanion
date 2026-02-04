import { normalizeSymbol } from "./ask";

export function extractSymbolFromMessageData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  const raw = obj.symbol;
  return typeof raw === "string" && raw.trim() ? normalizeSymbol(raw) : null;
}

export function inferSymbolFromThreadMessages(messages: { data: unknown }[]): string | null {
  for (const m of messages) {
    const inferred = extractSymbolFromMessageData(m.data);
    if (inferred) return inferred;
  }
  return null;
}
