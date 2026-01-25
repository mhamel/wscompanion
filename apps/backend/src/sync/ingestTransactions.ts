import type { Prisma, PrismaClient } from "@prisma/client";

export type IngestTransactionInput = {
  userId: string;
  accountId: string;
  provider: string;
  externalId: string;
  executedAt: Date;
  type: string;
  instrumentId?: string | null;
  optionContractId?: string | null;
  quantity?: Prisma.Decimal | string | null;
  priceAmountMinor?: bigint | null;
  priceCurrency?: string | null;
  grossAmountMinor?: bigint | null;
  feesAmountMinor?: bigint | null;
  feesCurrency?: string | null;
  notes?: string | null;
  raw?: Prisma.InputJsonValue | null;
};

export type IngestTransactionsResult = {
  total: number;
  inserted: number;
  deduped: number;
};

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const safe = JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
  return safe;
}

export async function ingestTransactions(
  prisma: PrismaClient,
  input: IngestTransactionInput[],
): Promise<IngestTransactionsResult> {
  if (input.length === 0) {
    return { total: 0, inserted: 0, deduped: 0 };
  }

  for (const tx of input) {
    if (tx.instrumentId && tx.optionContractId) {
      throw new Error(
        "Invalid transaction: instrumentId and optionContractId are mutually exclusive",
      );
    }
  }

  const data: Prisma.TransactionCreateManyInput[] = input.map((tx) => ({
    userId: tx.userId,
    accountId: tx.accountId,
    provider: tx.provider,
    externalId: tx.externalId,
    executedAt: tx.executedAt,
    type: tx.type,
    instrumentId: tx.instrumentId ?? undefined,
    optionContractId: tx.optionContractId ?? undefined,
    quantity: tx.quantity ?? undefined,
    priceAmountMinor: tx.priceAmountMinor ?? undefined,
    priceCurrency: tx.priceCurrency ?? undefined,
    grossAmountMinor: tx.grossAmountMinor ?? undefined,
    feesAmountMinor: tx.feesAmountMinor ?? undefined,
    feesCurrency: tx.feesCurrency ?? undefined,
    notes: tx.notes ?? undefined,
    raw: tx.raw ?? undefined,
  }));

  const result = await prisma.transaction.createMany({ data, skipDuplicates: true });
  return { total: input.length, inserted: result.count, deduped: input.length - result.count };
}
