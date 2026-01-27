export type WheelLegKind =
  | "sold_put"
  | "sold_call"
  | "bought_put"
  | "assigned_put"
  | "called_away"
  | "stock_buy"
  | "stock_sell"
  | "dividend"
  | "fee";

export type WheelTransactionInput = {
  id: string;
  executedAt: Date;
  type: string;
  optionContract: { right: string | null } | null;
  raw: unknown | null;
};

export type WheelLegDraft = {
  kind: WheelLegKind;
  occurredAt: Date;
  transactionId: string | null;
  raw: unknown | null;
};

export type WheelCycleDraft = {
  symbol: string;
  status: "open" | "closed";
  openedAt: Date;
  closedAt: Date | null;
  legs: WheelLegDraft[];
};

export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function classifyWheelLegKind(tx: {
  type: string;
  optionContract: { right: string | null } | null;
}): WheelLegKind | null {
  const t = tx.type.trim().toLowerCase();
  if (!t) return null;

  if (t.includes("dividend")) return "dividend";
  if (t.includes("fee") || t.includes("commission")) return "fee";

  const rightRaw = tx.optionContract?.right?.trim().toLowerCase() ?? "";
  const right =
    rightRaw.startsWith("p") || t.includes("put")
      ? "put"
      : rightRaw.startsWith("c") || t.includes("call")
        ? "call"
        : "";
  const isOption = Boolean(tx.optionContract) || t.includes("option") || right.length > 0;
  const isAssignment = t.includes("assigned") || t.includes("assignment") || t.includes("exercise");

  if (isOption) {
    if (isAssignment) {
      if (right === "put") return "assigned_put";
      if (right === "call") return "called_away";
      return null;
    }

    if (t.includes("sell") || t.includes("sto")) {
      if (right === "put") return "sold_put";
      if (right === "call") return "sold_call";
      return null;
    }

    if (t.includes("buy") || t.includes("bto")) {
      if (right === "put") return "bought_put";
      return null;
    }

    return null;
  }

  if (t.includes("buy")) return "stock_buy";
  if (t.includes("sell")) return "stock_sell";
  return null;
}

export function detectWheelCycles(input: {
  symbol: string;
  transactions: WheelTransactionInput[];
}): WheelCycleDraft[] {
  const cycles: WheelCycleDraft[] = [];
  let current: WheelCycleDraft | null = null;

  for (const tx of input.transactions) {
    const kind = classifyWheelLegKind(tx);
    if (!kind) continue;

    const isCycleStart = kind === "sold_put" || kind === "sold_call";

    if (!current) {
      if (!isCycleStart) continue;
      current = {
        symbol: input.symbol,
        status: "open",
        openedAt: tx.executedAt,
        closedAt: null,
        legs: [],
      };
    } else if (kind === "sold_put" && current.legs.some((l) => l.kind === "sold_put")) {
      const lastAt = current.legs[current.legs.length - 1]?.occurredAt ?? tx.executedAt;
      current.closedAt = lastAt;
      current.status = "open";
      cycles.push(current);
      current = {
        symbol: input.symbol,
        status: "open",
        openedAt: tx.executedAt,
        closedAt: null,
        legs: [],
      };
    }

    current.legs.push({
      kind,
      occurredAt: tx.executedAt,
      transactionId: tx.id,
      raw: tx.raw,
    });

    if (kind === "called_away") {
      current.status = "closed";
      current.closedAt = tx.executedAt;
      cycles.push(current);
      current = null;
    }
  }

  if (current) {
    cycles.push(current);
  }

  return cycles;
}
