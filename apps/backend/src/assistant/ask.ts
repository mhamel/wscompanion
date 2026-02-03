import type { NewsItem, TickerPnlTotal } from "@prisma/client";

export type AskSource =
  | { type: "pnl_total"; symbol: string; baseCurrency: string; lastRecomputedAt: string }
  | { type: "news"; url: string; title: string; publisher?: string; publishedAt: string }
  | { type: "transactions_count"; symbol: string; since: string; count: number };

export type AskSection = {
  title: string;
  bullets: string[];
  sources: AskSource[];
};

export type AskResponse = {
  answer: string;
  sections: AskSection[];
};

export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function extractSymbolFromQuestion(question: string): string | null {
  const matches = question.toUpperCase().match(/\b[A-Z]{1,5}\b/g);
  if (!matches) return null;
  const candidate = matches[0];
  return candidate ? candidate : null;
}

function formatMoneyMinor(amountMinor: bigint, currency: string): string {
  const sign = amountMinor < 0n ? "-" : "";
  const abs = amountMinor < 0n ? -amountMinor : amountMinor;
  const dollars = abs / 100n;
  const cents = abs % 100n;
  return `${sign}${currency} ${dollars.toString()}.${cents.toString().padStart(2, "0")}`;
}

export function buildAskResponse(input: {
  question: string;
  symbol?: string;
  baseCurrency: string;
  pnlTotal?: TickerPnlTotal | null;
  transactionsSince: Date;
  transactionsCount: number;
  news: Pick<NewsItem, "url" | "title" | "publisher" | "publishedAt">[];
}): AskResponse {
  const symbol = input.symbol ? normalizeSymbol(input.symbol) : null;
  const subject = symbol ? `sur ${symbol}` : "sur ton portefeuille";

  const sections: AskSection[] = [];

  if (symbol) {
    const sources: AskSource[] = [];

    const bullets: string[] = [];
    if (input.pnlTotal) {
      bullets.push(
        `P&L net: ${formatMoneyMinor(input.pnlTotal.netPnlMinor, input.pnlTotal.baseCurrency)}`,
      );
      bullets.push(
        `Réalisé: ${formatMoneyMinor(input.pnlTotal.realizedPnlMinor, input.pnlTotal.baseCurrency)} • Non réalisé: ${formatMoneyMinor(input.pnlTotal.unrealizedPnlMinor, input.pnlTotal.baseCurrency)}`,
      );
      bullets.push(
        `Primes options: ${formatMoneyMinor(input.pnlTotal.optionPremiumsMinor, input.pnlTotal.baseCurrency)} • Dividendes: ${formatMoneyMinor(input.pnlTotal.dividendsMinor, input.pnlTotal.baseCurrency)} • Fees: ${formatMoneyMinor(input.pnlTotal.feesMinor, input.pnlTotal.baseCurrency)}`,
      );

      sources.push({
        type: "pnl_total",
        symbol,
        baseCurrency: input.pnlTotal.baseCurrency,
        lastRecomputedAt: input.pnlTotal.lastRecomputedAt.toISOString(),
      });
    } else {
      bullets.push("Pas d’agrégat P&L disponible pour ce symbole (sync ou recompute manquant).");
    }

    sources.push({
      type: "transactions_count",
      symbol,
      since: input.transactionsSince.toISOString(),
      count: input.transactionsCount,
    });

    bullets.push(
      `Activité récente: ${input.transactionsCount} transaction(s) depuis ${input.transactionsSince.toISOString().slice(0, 10)}.`,
    );

    sections.push({ title: "Résumé P&L & activité", bullets, sources });

    if (input.news.length > 0) {
      sections.push({
        title: "News récentes",
        bullets: input.news.slice(0, 5).map((n) => n.title),
        sources: input.news.slice(0, 5).map((n) => ({
          type: "news",
          url: n.url,
          title: n.title,
          publisher: n.publisher ?? undefined,
          publishedAt: n.publishedAt.toISOString(),
        })),
      });
    }
  }

  const answer =
    sections.length > 0
      ? `Voici ce que je vois ${subject} (sans conseil financier):`
      : `Je peux t’aider à analyser ${subject}. Donne un symbole (ex: AAPL) pour que je récupère P&L, transactions et news.`;

  return { answer, sections };
}
