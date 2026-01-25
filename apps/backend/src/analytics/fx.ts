export const FX_RATE_SCALE = 1_000_000_000n;

export type FxRateProvider = {
  getRateScaled: (input: { from: string; to: string; asOf: Date }) => bigint | null;
};

function parseRateToScaled(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return BigInt(Math.round(value * Number(FX_RATE_SCALE)));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
    return BigInt(Math.round(asNumber * Number(FX_RATE_SCALE)));
  }
  return null;
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

type RatesMap = Map<string, bigint>;

function pairKey(from: string, to: string): string {
  return `${normalizeCurrency(from)}_${normalizeCurrency(to)}`;
}

function loadRatesFromJson(raw: string): RatesMap {
  const parsed = JSON.parse(raw) as unknown;
  const map: RatesMap = new Map();

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("FX_RATES_JSON must be a JSON object");
  }

  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!k) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const from = normalizeCurrency(k);
      for (const [to, rateRaw] of Object.entries(v as Record<string, unknown>)) {
        const scaled = parseRateToScaled(rateRaw);
        if (!scaled) continue;
        map.set(pairKey(from, to), scaled);
      }
      continue;
    }

    const scaled = parseRateToScaled(v);
    if (!scaled) continue;

    const key = k.trim().toUpperCase();
    if (key.includes("_")) {
      const [from, to] = key.split("_", 2);
      if (from && to) map.set(pairKey(from, to), scaled);
      continue;
    }

    if (key.length === 6) {
      map.set(pairKey(key.slice(0, 3), key.slice(3)), scaled);
    }
  }

  return map;
}

export function createEnvFxRateProvider(env: NodeJS.ProcessEnv = process.env): FxRateProvider {
  const raw = env.FX_RATES_JSON?.trim();
  const rates = raw ? loadRatesFromJson(raw) : new Map<string, bigint>();

  return {
    getRateScaled: ({ from, to }) => {
      const fromNorm = normalizeCurrency(from);
      const toNorm = normalizeCurrency(to);
      if (fromNorm === toNorm) return FX_RATE_SCALE;
      const direct = rates.get(pairKey(fromNorm, toNorm));
      if (direct) return direct;
      const inverse = rates.get(pairKey(toNorm, fromNorm));
      if (!inverse) return null;
      return (FX_RATE_SCALE * FX_RATE_SCALE) / inverse;
    },
  };
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function mulDivRoundSigned(value: bigint, mul: bigint, div: bigint): bigint {
  if (div === 0n) {
    throw new Error("Division by zero");
  }

  const sign = value < 0n ? -1n : 1n;
  const absValue = absBigInt(value);
  const absMul = absBigInt(mul);
  const absDiv = absBigInt(div);
  const half = absDiv / 2n;
  const rounded = (absValue * absMul + half) / absDiv;
  return rounded * sign;
}

export function convertMinorAmount(input: {
  amountMinor: bigint;
  fromCurrency: string;
  toCurrency: string;
  asOf: Date;
  fx: FxRateProvider;
}): { amountMinor: bigint; ok: boolean } {
  const from = normalizeCurrency(input.fromCurrency);
  const to = normalizeCurrency(input.toCurrency);
  if (from === to) return { amountMinor: input.amountMinor, ok: true };

  const rateScaled = input.fx.getRateScaled({ from, to, asOf: input.asOf });
  if (!rateScaled) return { amountMinor: input.amountMinor, ok: false };

  return {
    amountMinor: mulDivRoundSigned(input.amountMinor, rateScaled, FX_RATE_SCALE),
    ok: true,
  };
}

