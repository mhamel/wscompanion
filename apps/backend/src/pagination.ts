function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function encodeCursor(data: unknown): string {
  return toBase64Url(Buffer.from(JSON.stringify(data), "utf8"));
}

export function decodeCursor<T>(cursor: string): T | null {
  try {
    const json = fromBase64Url(cursor).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function parseLimit(
  input: unknown,
  defaults: { defaultValue: number; max: number },
): number {
  const n = typeof input === "string" ? Number(input) : typeof input === "number" ? input : NaN;
  if (!Number.isFinite(n)) return defaults.defaultValue;
  const i = Math.trunc(n);
  if (i <= 0) return defaults.defaultValue;
  return Math.min(i, defaults.max);
}
