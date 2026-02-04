import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";
import { bumpPnlCacheVersion } from "../analytics/pnlCache";

type Args = {
  email: string;
  baseCurrency: string;
  days: number;
  reset: boolean;
  symbols: string[];
  bumpCache: boolean;
};

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};

  const symbols: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      throw new Error("HELP");
    }
    if (a === "--reset") {
      args.reset = true;
      continue;
    }
    if (a === "--noBumpCache") {
      args.bumpCache = false;
      continue;
    }
    if (a === "--email") {
      args.email = argv[++i];
      continue;
    }
    if (a === "--baseCurrency") {
      args.baseCurrency = argv[++i];
      continue;
    }
    if (a === "--days") {
      const raw = argv[++i];
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --days: ${raw}`);
      }
      args.days = Math.floor(parsed);
      continue;
    }
    if (a === "--symbol") {
      symbols.push(argv[++i]);
      continue;
    }
    if (a === "--symbols") {
      const raw = argv[++i] ?? "";
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => symbols.push(s));
      continue;
    }

    throw new Error(`Unknown arg: ${a}`);
  }

  const email = (args.email ?? "").trim();
  if (!email) throw new Error("Missing --email");

  const baseCurrency = normalizeCurrency(args.baseCurrency ?? "USD");
  const days = args.days ?? 60;

  const defaultSymbols = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "SPY", "QQQ"];
  const effectiveSymbols = (symbols.length ? symbols : defaultSymbols).map(normalizeSymbol);

  return {
    email,
    baseCurrency,
    days,
    reset: Boolean(args.reset),
    symbols: effectiveSymbols,
    bumpCache: args.bumpCache !== false,
  };
}

function usage() {
  // Keep this short: it’s printed to terminals.
  console.log("Seed dev PnL + news data.");
  console.log("");
  console.log("Usage:");
  console.log("  npm --workspace apps/backend run seed:dev -- --email you@domain.tld [--reset] [--days 60]");
  console.log("  npm --workspace apps/backend run seed:dev -- --email demo@justlovethestocks.local --symbols AAPL,TSLA");
  console.log("");
  console.log("Options:");
  console.log("  --email <email>          User to seed (created if missing)");
  console.log("  --baseCurrency <ccy>     Default: USD");
  console.log("  --days <n>               Default: 60 (timeline rows per symbol)");
  console.log("  --reset                  Delete existing PnL rows for these symbols first");
  console.log("  --noBumpCache             Do not bump Redis pnl cache version key");
  console.log("  --symbol <SYM>           Repeatable");
  console.log("  --symbols AAPL,TSLA,...  Comma-separated list");
}

function sha256Bytes(input: string): Uint8Array<ArrayBuffer> {
  const digest = createHash("sha256").update(input).digest();
  const out = new Uint8Array(new ArrayBuffer(digest.byteLength));
  out.set(digest);
  return out;
}

function dateAtUtcMidnight(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function buildSeedSpecs(symbols: string[]) {
  // values are in MINOR UNITS (e.g., cents)
  const defaults: Record<
    string,
    { marketValueBase: bigint; netBase: bigint; netSlopePerDay: bigint; mvSlopePerDay: bigint }
  > = {
    AAPL: { marketValueBase: 1_250_000n, netBase: 42_000n, netSlopePerDay: 220n, mvSlopePerDay: 180n },
    MSFT: { marketValueBase: 1_900_000n, netBase: 88_000n, netSlopePerDay: 260n, mvSlopePerDay: 240n },
    NVDA: { marketValueBase: 2_350_000n, netBase: 165_000n, netSlopePerDay: 520n, mvSlopePerDay: 460n },
    TSLA: { marketValueBase: 1_100_000n, netBase: -55_000n, netSlopePerDay: 180n, mvSlopePerDay: 140n },
    AMZN: { marketValueBase: 1_450_000n, netBase: 24_000n, netSlopePerDay: 210n, mvSlopePerDay: 190n },
    META: { marketValueBase: 1_050_000n, netBase: 12_000n, netSlopePerDay: 160n, mvSlopePerDay: 150n },
    SPY: { marketValueBase: 2_750_000n, netBase: 36_000n, netSlopePerDay: 90n, mvSlopePerDay: 140n },
    QQQ: { marketValueBase: 2_150_000n, netBase: 28_000n, netSlopePerDay: 110n, mvSlopePerDay: 150n },
  };

  return symbols.map((s, idx) => {
    const spec =
      defaults[s] ??
      ({
        marketValueBase: 800_000n + BigInt(idx) * 75_000n,
        netBase: BigInt((idx % 2 === 0 ? 1 : -1) * (10_000 + idx * 2_000)),
        netSlopePerDay: 120n + BigInt(idx) * 15n,
        mvSlopePerDay: 90n + BigInt(idx) * 10n,
      } satisfies (typeof defaults)["AAPL"]);
    return { symbol: s, ...spec };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: args.email },
      update: {},
      create: { email: args.email },
      select: { id: true, email: true },
    });

    const now = new Date();
    const lastRecomputedAt = now;

    const specs = buildSeedSpecs(args.symbols);

    const totalRows = specs.map((spec) => {
      const realized = spec.netBase / 2n;
      const unrealized = spec.netBase - realized;
      const optionPremiums = 7_500n;
      const dividends = spec.symbol === "SPY" || spec.symbol === "QQQ" ? 3_500n : 1_250n;
      const fees = 450n;
      const net = realized + unrealized + optionPremiums + dividends - fees;

      return {
        userId: user.id,
        symbol: spec.symbol,
        baseCurrency: args.baseCurrency,
        realizedPnlMinor: realized,
        unrealizedPnlMinor: unrealized,
        optionPremiumsMinor: optionPremiums,
        dividendsMinor: dividends,
        feesMinor: fees,
        netPnlMinor: net,
        lastRecomputedAt,
      };
    });

    const todayUtc = dateAtUtcMidnight(now);
    const startUtc = addUtcDays(todayUtc, -(args.days - 1));

    const dailyRows = specs.flatMap((spec) => {
      const rows: {
        userId: string;
        symbol: string;
        baseCurrency: string;
        date: Date;
        netPnlMinor: bigint;
        marketValueMinor: bigint;
        realizedPnlMinor: bigint;
        unrealizedPnlMinor: bigint;
      }[] = [];

      for (let i = 0; i < args.days; i++) {
        const date = addUtcDays(startUtc, i);

        // cheap deterministic "noise" using the day index
        const noise = BigInt(((i * 17 + spec.symbol.length * 13) % 41) - 20); // [-20..20]
        const wave = BigInt(Math.round(Math.sin(i / 7) * 25)); // [-25..25]

        const marketValueMinor =
          spec.marketValueBase + spec.mvSlopePerDay * BigInt(i) + (noise + wave) * 75n;

        const netPnlMinor = spec.netBase + spec.netSlopePerDay * BigInt(i) + (noise - wave) * 30n;

        const realized = netPnlMinor / 3n;
        const unrealized = netPnlMinor - realized;

        rows.push({
          userId: user.id,
          symbol: spec.symbol,
          baseCurrency: args.baseCurrency,
          date,
          netPnlMinor,
          marketValueMinor,
          realizedPnlMinor: realized,
          unrealizedPnlMinor: unrealized,
        });
      }

      return rows;
    });

    const seedNews = [
      {
        url: "https://example.com/seed/apple-earnings",
        title: "Apple earnings beat expectations (seed)",
        publisher: "Seed Newswire",
        summary: "Synthetic dev data: use this to validate the mobile news UI without external providers.",
        publishedAt: addUtcDays(now, -1),
        symbols: ["AAPL"],
      },
      {
        url: "https://example.com/seed/nvda-ai-demand",
        title: "AI demand stays strong for GPU vendors (seed)",
        publisher: "Seed Newswire",
        summary: "Synthetic dev data with multiple symbols.",
        publishedAt: addUtcDays(now, -2),
        symbols: ["NVDA", "MSFT"],
      },
      {
        url: "https://example.com/seed/tesla-deliveries",
        title: "EV deliveries: week-over-week update (seed)",
        publisher: "Seed Newswire",
        summary: "Synthetic dev data: intended for `/v1/tickers/:symbol/news`.",
        publishedAt: addUtcDays(now, -3),
        symbols: ["TSLA"],
      },
      {
        url: "https://example.com/seed/market-wrap",
        title: "Market wrap: index recap (seed)",
        publisher: "Seed Newswire",
        summary: "Synthetic dev data for broad tickers.",
        publishedAt: addUtcDays(now, -4),
        symbols: ["SPY", "QQQ"],
      },
    ];

    const newsUpserts = seedNews.map((n) => ({
      provider: "seed",
      url: n.url,
      urlHash: sha256Bytes(n.url),
      title: n.title,
      publisher: n.publisher,
      summary: n.summary,
      publishedAt: n.publishedAt,
      symbols: n.symbols.map(normalizeSymbol),
    }));

    await prisma.$transaction(async (tx) => {
      await tx.userPreferences.upsert({
        where: { userId: user.id },
        update: { baseCurrency: args.baseCurrency },
        create: { userId: user.id, baseCurrency: args.baseCurrency },
      });

      if (args.reset) {
        await tx.tickerPnlDaily.deleteMany({
          where: { userId: user.id, baseCurrency: args.baseCurrency, symbol: { in: args.symbols } },
        });
        await tx.tickerPnlTotal.deleteMany({
          where: { userId: user.id, baseCurrency: args.baseCurrency, symbol: { in: args.symbols } },
        });
      }

      await tx.tickerPnlTotal.createMany({ data: totalRows, skipDuplicates: true });
      await tx.tickerPnlDaily.createMany({ data: dailyRows, skipDuplicates: true });

      for (const item of newsUpserts) {
        const news = await tx.newsItem.upsert({
          where: { urlHash: item.urlHash },
          update: {
            provider: item.provider,
            url: item.url,
            title: item.title,
            publisher: item.publisher,
            summary: item.summary,
            publishedAt: item.publishedAt,
          },
          create: {
            provider: item.provider,
            url: item.url,
            urlHash: item.urlHash,
            title: item.title,
            publisher: item.publisher,
            summary: item.summary,
            publishedAt: item.publishedAt,
          },
          select: { id: true },
        });

        await tx.newsItemSymbol.createMany({
          data: item.symbols.map((symbol) => ({ newsItemId: news.id, symbol })),
          skipDuplicates: true,
        });
      }
    });

    let bumpedVersion: number | null | "skipped" = "skipped";
    if (args.bumpCache) {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl && redisUrl.trim()) {
        const redis = createClient({ url: redisUrl });
        try {
          await redis.connect();
          bumpedVersion = await bumpPnlCacheVersion(redis, user.id, args.baseCurrency);
        } catch {
          bumpedVersion = null;
        } finally {
          try {
            await redis.quit();
          } catch {
            // ignore quit errors
          }
        }
      }
    }

    console.log("Seed OK");
    console.log(`User: ${user.email}`);
    console.log(`Base currency: ${args.baseCurrency}`);
    console.log(`Tickers: ${args.symbols.join(", ")}`);
    console.log(`PnL totals: ${totalRows.length}`);
    console.log(`PnL daily rows: ${dailyRows.length} (${args.days} days per symbol)`);
    console.log(`News items: ${newsUpserts.length}`);
    console.log(
      `Redis pnl cache version: ${
        bumpedVersion === "skipped" ? "skipped" : bumpedVersion === null ? "failed" : `bumped to ${bumpedVersion}`
      }`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  if (err instanceof Error && err.message === "HELP") {
    usage();
    process.exit(0);
  }
  if (err instanceof Error && err.message.startsWith("Missing --email")) {
    usage();
  }
  console.error(err);
  process.exit(1);
});
