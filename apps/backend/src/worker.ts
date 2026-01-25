import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";
import { ingestTransactions, toJsonValue } from "./sync/ingestTransactions";
import { computeTickerPnl360 } from "./analytics/pnl";
import { bumpPnlCacheVersion } from "./analytics/pnlCache";
import { generateExportCsv } from "./exports/csv";
import { createS3ExportsClient, uploadExportObject, type S3ExportsClient } from "./exports/s3";
import { isExportType } from "./exports/types";
import { loadDevSecrets } from "./devSecrets";
import { getNewsScheduleEverySeconds, loadNewsRssFeeds } from "./news/config";
import { ingestNewsRssFeed } from "./news/ingest";

type SyncJob = {
  syncRunId: string;
  brokerConnectionId: string;
  userId: string;
};

type AnalyticsJob = {
  userId: string;
  symbol?: string;
};

type NewsJob = Record<string, never>;
type AlertsJob = Record<string, never>;
type ExportsJob = { exportJobId: string; error?: string };

type MockTransaction = {
  externalId: string;
  executedAt: Date;
  type: string;
  raw: Record<string, unknown>;
};

function parseMockTransactions(rawJson: string): MockTransaction[] {
  const parsed = JSON.parse(rawJson) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("SYNC_MOCK_TRANSACTIONS_JSON must be a JSON array");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`SYNC_MOCK_TRANSACTIONS_JSON[${index}] must be an object`);
    }

    const obj = item as Record<string, unknown>;
    const externalId =
      typeof obj.externalId === "string"
        ? obj.externalId
        : typeof obj.id === "string"
          ? obj.id
          : "";

    const executedAtRaw =
      typeof obj.executedAt === "string"
        ? obj.executedAt
        : typeof obj.executed_at === "string"
          ? obj.executed_at
          : "";

    const executedAt = new Date(executedAtRaw);
    if (!externalId || !Number.isFinite(executedAt.getTime())) {
      throw new Error(`SYNC_MOCK_TRANSACTIONS_JSON[${index}] missing externalId/executedAt`);
    }

    const type =
      typeof obj.type === "string" ? obj.type : typeof obj.kind === "string" ? obj.kind : "unknown";

    return { externalId, executedAt, type, raw: obj };
  });
}

async function handleSyncJob(
  prisma: PrismaClient,
  job: Job<SyncJob>,
  mode: "initial" | "incremental",
  analyticsQueue?: Queue<AnalyticsJob>,
) {
  const now = new Date();

  const syncRun = await prisma.syncRun.findUnique({ where: { id: job.data.syncRunId } });
  if (!syncRun) {
    throw new Error("SyncRun not found");
  }

  if (syncRun.status === "done") {
    return { ok: true, skipped: true };
  }

  await prisma.syncRun.update({
    where: { id: syncRun.id },
    data: { status: "running", startedAt: now, error: null },
  });

  const brokerConnection = await prisma.brokerConnection.findUnique({
    where: { id: job.data.brokerConnectionId },
  });

  if (!brokerConnection || brokerConnection.userId !== job.data.userId) {
    throw new Error("BrokerConnection not found");
  }

  const account = await prisma.account.upsert({
    where: {
      brokerConnectionId_externalAccountId: {
        brokerConnectionId: brokerConnection.id,
        externalAccountId: "default",
      },
    },
    create: {
      userId: job.data.userId,
      brokerConnectionId: brokerConnection.id,
      externalAccountId: "default",
      name: "Main",
      type: "unknown",
      status: "active",
    },
    update: { status: "active" },
  });

  const mockRaw = process.env.SYNC_MOCK_TRANSACTIONS_JSON?.trim();
  const mockTransactions = mockRaw ? parseMockTransactions(mockRaw) : [];

  const ingestionResult = await ingestTransactions(
    prisma,
    mockTransactions.map((tx) => ({
      userId: job.data.userId,
      accountId: account.id,
      provider: brokerConnection.provider,
      externalId: tx.externalId,
      executedAt: tx.executedAt,
      type: tx.type,
      raw: toJsonValue(tx.raw),
    })),
  );

  const finishedAt = new Date();
  await prisma.brokerConnection.update({
    where: { id: brokerConnection.id },
    data: { lastSyncAt: finishedAt },
  });

  await prisma.syncRun.update({
    where: { id: syncRun.id },
    data: {
      status: "done",
      finishedAt,
      stats: {
        mode,
        brokerConnectionId: brokerConnection.id,
        accountId: account.id,
        usedMockTransactions: Boolean(mockRaw),
        transactions: ingestionResult,
      },
    },
  });

  if (analyticsQueue) {
    try {
      await analyticsQueue.add(
        "pnl-recompute",
        { userId: job.data.userId },
        { jobId: `pnl-recompute:${job.data.userId}`, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
      );
    } catch (err) {
      console.error("analytics: enqueue pnl-recompute failed", err);
    }
  }

  return { ok: true };
}

async function handleSyncScanJob(prisma: PrismaClient, syncQueue: Queue) {
  const connections = await prisma.brokerConnection.findMany({
    where: { status: "connected" },
    take: 100,
    orderBy: { updatedAt: "desc" },
  });

  let enqueued = 0;
  for (const connection of connections) {
    const inflight = await prisma.syncRun.findFirst({
      where: {
        brokerConnectionId: connection.id,
        status: { in: ["queued", "running"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (inflight) continue;

    const syncRun = await prisma.syncRun.create({
      data: {
        userId: connection.userId,
        brokerConnectionId: connection.id,
        status: "queued",
      },
    });

    try {
      await syncQueue.add(
        "sync-incremental",
        { syncRunId: syncRun.id, brokerConnectionId: connection.id, userId: connection.userId },
        { jobId: syncRun.id, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
      );
      enqueued += 1;
    } catch {
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: { status: "failed", finishedAt: new Date(), error: "ENQUEUE_FAILED" },
      });
    }
  }

  return { ok: true, scanned: connections.length, enqueued };
}

async function handlePnlRecomputeJob(
  prisma: PrismaClient,
  job: Job<AnalyticsJob>,
  cacheRedis?: { incr: (key: string) => Promise<number>; expire?: (key: string, seconds: number) => Promise<unknown> },
) {
  const userId = job.data.userId;
  const now = new Date();

  const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
  const baseCurrency = preferences?.baseCurrency ?? "USD";

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: {
      instrument: true,
      optionContract: { include: { underlyingInstrument: true } },
    },
    orderBy: [{ executedAt: "asc" }, { id: "asc" }],
    take: 50_000,
  });

  const positionSnapshots = await prisma.positionSnapshot.findMany({
    where: { account: { userId } },
    include: { instrument: true },
    take: 50_000,
  });

  const result = computeTickerPnl360({
    userId,
    baseCurrency,
    asOf: now,
    transactions,
    positionSnapshots,
  });

  await prisma.$transaction(async (tx) => {
    await tx.tickerPnlDaily.deleteMany({ where: { userId, baseCurrency } });
    await tx.tickerPnlTotal.deleteMany({ where: { userId, baseCurrency } });

    if (result.totals.length > 0) {
      await tx.tickerPnlTotal.createMany({
        data: result.totals.map((row) => ({
          userId,
          symbol: row.symbol,
          baseCurrency: row.baseCurrency,
          realizedPnlMinor: row.realizedPnlMinor,
          unrealizedPnlMinor: row.unrealizedPnlMinor,
          optionPremiumsMinor: row.optionPremiumsMinor,
          dividendsMinor: row.dividendsMinor,
          feesMinor: row.feesMinor,
          netPnlMinor: row.netPnlMinor,
          lastRecomputedAt: row.lastRecomputedAt,
        })),
      });
    }

    if (result.daily.length > 0) {
      await tx.tickerPnlDaily.createMany({
        data: result.daily.map((row) => ({
          userId,
          symbol: row.symbol,
          baseCurrency: row.baseCurrency,
          date: row.date,
          netPnlMinor: row.netPnlMinor,
          marketValueMinor: row.marketValueMinor,
          realizedPnlMinor: row.realizedPnlMinor,
          unrealizedPnlMinor: row.unrealizedPnlMinor,
        })),
      });
    }
  });

  if (result.anomalies.length > 0) {
    console.warn("pnl: anomalies", { userId, anomalies: result.anomalies.slice(0, 20) });
  }

  await bumpPnlCacheVersion(cacheRedis, userId, baseCurrency);

  return {
    ok: true,
    symbols: result.totals.length,
    dailyRows: result.daily.length,
    anomalies: result.anomalies.length,
    baseCurrency,
  };
}

type WheelLegDraft = {
  kind: string;
  occurredAt: Date;
  transactionId: string | null;
  raw: unknown | null;
};

type WheelCycleDraft = {
  symbol: string;
  status: "open" | "closed";
  openedAt: Date;
  closedAt: Date | null;
  legs: WheelLegDraft[];
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function classifyWheelLegKind(tx: {
  type: string;
  optionContract: { right: string } | null;
}): string | null {
  const t = tx.type.trim().toLowerCase();
  if (!t) return null;

  if (t.includes("dividend")) return "dividend";
  if (t.includes("fee") || t.includes("commission")) return "fee";

  const rightRaw = tx.optionContract?.right?.trim().toLowerCase() ?? "";
  const right = rightRaw.startsWith("p") || t.includes("put") ? "put" : rightRaw.startsWith("c") || t.includes("call") ? "call" : "";
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

function detectWheelCycles(input: {
  symbol: string;
  transactions: Array<{
    id: string;
    executedAt: Date;
    type: string;
    optionContract: { right: string } | null;
    raw: unknown | null;
  }>;
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

async function handleWheelDetectJob(prisma: PrismaClient, job: Job<AnalyticsJob>) {
  const userId = job.data.userId;
  const symbolFilter = typeof job.data.symbol === "string" ? normalizeSymbol(job.data.symbol) : "";

  const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
  const baseCurrency = preferences?.baseCurrency ?? "USD";

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(symbolFilter
        ? {
            OR: [
              { instrument: { symbol: symbolFilter } },
              { optionContract: { underlyingInstrument: { symbol: symbolFilter } } },
            ],
          }
        : {}),
    },
    include: {
      instrument: true,
      optionContract: { include: { underlyingInstrument: true } },
    },
    orderBy: [{ executedAt: "asc" }, { id: "asc" }],
    take: 100_000,
  });

  const bySymbol = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const symbol =
      tx.instrument?.symbol ?? tx.optionContract?.underlyingInstrument?.symbol ?? undefined;
    if (!symbol) continue;
    const key = normalizeSymbol(symbol);
    const arr = bySymbol.get(key) ?? [];
    arr.push(tx);
    bySymbol.set(key, arr);
  }

  let cyclesCreated = 0;
  for (const [symbol, txs] of bySymbol.entries()) {
    const detected = detectWheelCycles({
      symbol,
      transactions: txs.map((tx) => ({
        id: tx.id,
        executedAt: tx.executedAt,
        type: tx.type,
        optionContract: tx.optionContract ? { right: tx.optionContract.right } : null,
        raw: tx.raw,
      })),
    });

    await prisma.$transaction(async (db) => {
      const existing = await db.wheelCycle.findMany({
        where: { userId, symbol, autoDetected: true },
        select: { id: true },
      });
      const ids = existing.map((c) => c.id);
      if (ids.length > 0) {
        await db.wheelLeg.deleteMany({ where: { wheelCycleId: { in: ids } } });
        await db.wheelCycle.deleteMany({ where: { id: { in: ids } } });
      }

      for (const cycle of detected) {
        await db.wheelCycle.create({
          data: {
            userId,
            symbol: cycle.symbol,
            status: cycle.status,
            openedAt: cycle.openedAt,
            closedAt: cycle.closedAt,
            netPnlMinor: null,
            baseCurrency,
            autoDetected: true,
            legs: {
              create: cycle.legs.map((leg) => ({
                kind: leg.kind,
                transactionId: leg.transactionId,
                linkedTransactionIds: [],
                occurredAt: leg.occurredAt,
                pnlMinor: null,
                raw: leg.raw ?? undefined,
              })),
            },
          },
        });
      }
    });

    cyclesCreated += detected.length;
  }

  return { ok: true, symbols: bySymbol.size, cycles: cyclesCreated, baseCurrency };
}

async function handleNewsScanJob(prisma: PrismaClient, redis: IORedis) {
  const feeds = loadNewsRssFeeds(process.env);
  if (feeds.length === 0) {
    return { ok: true, skipped: true, reason: "NO_FEEDS_CONFIGURED" };
  }

  let fetchedFeeds = 0;
  let itemsParsed = 0;
  let itemsInserted = 0;
  let symbolsLinked = 0;
  const errors: Array<{ provider: string; url: string; error: string }> = [];

  for (const feed of feeds) {
    try {
      const res = await ingestNewsRssFeed({ prisma, redis, feed });
      if (res.fetched) fetchedFeeds += 1;
      itemsParsed += res.itemsParsed;
      itemsInserted += res.itemsInserted;
      symbolsLinked += res.symbolsLinked;
    } catch (err) {
      errors.push({
        provider: feed.provider,
        url: feed.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (errors.length > 0) {
    console.warn("news: ingestion errors", { count: errors.length, errors: errors.slice(0, 3) });
  }

  return {
    ok: true,
    feeds: feeds.length,
    fetchedFeeds,
    itemsParsed,
    itemsInserted,
    symbolsLinked,
    errors: errors.length,
  };
}

function parseNewsSpikeConfig(config: unknown): { lookbackHours: number; minArticles: number } {
  const defaults = { lookbackHours: 12, minArticles: 5 };
  if (!config || typeof config !== "object" || Array.isArray(config)) return defaults;
  const obj = config as Record<string, unknown>;
  const lookbackHours = typeof obj.lookbackHours === "number" ? obj.lookbackHours : defaults.lookbackHours;
  const minArticles = typeof obj.minArticles === "number" ? obj.minArticles : defaults.minArticles;
  return {
    lookbackHours: Number.isFinite(lookbackHours) && lookbackHours > 0 ? Math.min(Math.trunc(lookbackHours), 168) : defaults.lookbackHours,
    minArticles: Number.isFinite(minArticles) && minArticles > 0 ? Math.min(Math.trunc(minArticles), 1000) : defaults.minArticles,
  };
}

async function handleAlertsEvaluateJob(prisma: PrismaClient) {
  const now = new Date();
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true, type: "news_spike", symbol: { not: null } },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  let evaluated = 0;
  let triggered = 0;
  let skipped = 0;

  for (const rule of rules) {
    const symbol = rule.symbol?.trim().toUpperCase();
    if (!symbol) continue;
    const cfg = parseNewsSpikeConfig(rule.config);
    const windowStart = new Date(now.getTime() - cfg.lookbackHours * 60 * 60 * 1000);

    const recentEvent = await prisma.alertEvent.findFirst({
      where: { alertRuleId: rule.id, triggeredAt: { gte: windowStart } },
      orderBy: { triggeredAt: "desc" },
    });
    if (recentEvent) {
      skipped += 1;
      continue;
    }

    const count = await prisma.newsItemSymbol.count({
      where: { symbol, newsItem: { publishedAt: { gte: windowStart } } },
    });

    evaluated += 1;
    if (count < cfg.minArticles) continue;

    await prisma.alertEvent.create({
      data: {
        alertRuleId: rule.id,
        triggeredAt: now,
        payload: { kind: "news_spike", symbol, count, lookbackHours: cfg.lookbackHours, minArticles: cfg.minArticles },
      },
    });
    triggered += 1;
  }

  return { ok: true, rules: rules.length, evaluated, triggered, skipped };
}

async function handleExportRunJob(
  prisma: PrismaClient,
  job: Job<ExportsJob>,
  s3: S3ExportsClient | null,
) {
  const exportJob = await prisma.exportJob.findUnique({
    where: { id: job.data.exportJobId },
    include: { file: true },
  });
  if (!exportJob) {
    throw new Error("ExportJob not found");
  }

  if (exportJob.status === "succeeded" && exportJob.file) {
    return { ok: true, skipped: true };
  }

  await prisma.exportJob.update({
    where: { id: exportJob.id },
    data: { status: "running", error: null, completedAt: null },
  });

  if (!isExportType(exportJob.type)) {
    throw new Error(`Unsupported export type: ${exportJob.type}`);
  }

  if (exportJob.format !== "csv") {
    throw new Error(`Unsupported export format: ${exportJob.format}`);
  }

  if (!s3) {
    throw new Error("S3 exports not configured");
  }

  const generated = await generateExportCsv({
    prisma,
    userId: exportJob.userId,
    type: exportJob.type,
    params: exportJob.params,
  });

  const storageKey = `exports/${exportJob.userId}/${exportJob.id}/${generated.filename}`;
  const uploaded = await uploadExportObject({
    s3,
    key: storageKey,
    body: generated.body,
    contentType: generated.contentType,
  });

  await prisma.$transaction(async (tx) => {
    await tx.exportFile.upsert({
      where: { exportJobId: exportJob.id },
      create: {
        exportJobId: exportJob.id,
        storageKey: uploaded.storageKey,
        contentType: generated.contentType,
        sizeBytes: uploaded.sizeBytes,
        sha256: uploaded.sha256,
      },
      update: {
        storageKey: uploaded.storageKey,
        contentType: generated.contentType,
        sizeBytes: uploaded.sizeBytes,
        sha256: uploaded.sha256,
      },
    });

    await tx.exportJob.update({
      where: { id: exportJob.id },
      data: { status: "succeeded", completedAt: new Date(), error: null },
    });
  });

  return { ok: true, exportJobId: exportJob.id, type: exportJob.type };
}

async function main() {
  dotenv.config();
  loadDevSecrets();
  const config = loadConfig();
  const s3 = createS3ExportsClient(config);

  const prisma = new PrismaClient();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const syncQueue = new Queue("sync", { connection });
  const dlq = new Queue("sync-dlq", { connection });
  const analyticsQueue = new Queue<AnalyticsJob>("analytics", { connection });
  const analyticsDlq = new Queue("analytics-dlq", { connection });
  const newsQueue = new Queue<NewsJob>("news", { connection });
  const newsDlq = new Queue("news-dlq", { connection });
  const alertsQueue = new Queue<AlertsJob>("alerts", { connection });
  const alertsDlq = new Queue("alerts-dlq", { connection });
  const exportsQueue = new Queue<ExportsJob>("exports", { connection });
  const exportsDlq = new Queue("exports-dlq", { connection });

  const scheduleEverySeconds = Number(process.env.SYNC_SCHEDULE_EVERY_SECONDS ?? "3600");
  if (Number.isFinite(scheduleEverySeconds) && scheduleEverySeconds > 0) {
    await syncQueue.add(
      "sync-scan",
      {},
      { repeat: { every: scheduleEverySeconds * 1000 }, jobId: "sync-scan" },
    );
  }

  const newsEverySeconds = getNewsScheduleEverySeconds(process.env);
  if (newsEverySeconds > 0) {
    await newsQueue.add("news-scan", {}, { repeat: { every: newsEverySeconds * 1000 }, jobId: "news-scan" });
  }

  const alertsEverySeconds = Number(process.env.ALERTS_SCHEDULE_EVERY_SECONDS ?? "300");
  if (Number.isFinite(alertsEverySeconds) && alertsEverySeconds > 0) {
    await alertsQueue.add(
      "alerts-evaluate",
      {},
      { repeat: { every: alertsEverySeconds * 1000 }, jobId: "alerts-evaluate" },
    );
  }

  const worker = new Worker(
    "sync",
    async (job) => {
      try {
        if (job.name === "sync-initial") {
          return await handleSyncJob(prisma, job as Job<SyncJob>, "initial", analyticsQueue);
        }

        if (job.name === "sync-incremental") {
          return await handleSyncJob(prisma, job as Job<SyncJob>, "incremental", analyticsQueue);
        }

        if (job.name === "sync-scan") {
          return await handleSyncScanJob(prisma, syncQueue);
        }

        throw new Error(`Unknown job: ${job.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (job.name === "sync-initial" || job.name === "sync-incremental") {
          await prisma.syncRun.update({
            where: { id: (job.data as SyncJob).syncRunId },
            data: { status: "failed", finishedAt: new Date(), error: errorMessage },
          });

          const attempts = job.opts.attempts ?? 1;
          const isFinalAttempt = job.attemptsMade + 1 >= attempts;
          if (isFinalAttempt) {
            await dlq.add(
              job.name,
              { ...(job.data as SyncJob), error: errorMessage },
              { jobId: `dlq:${job.id ?? (job.data as SyncJob).syncRunId}` },
            );
          }
        }

        throw err;
      }
    },
    { connection },
  );

  const analyticsWorker = new Worker(
    "analytics",
    async (job) => {
      try {
        if (job.name === "pnl-recompute") {
          return await handlePnlRecomputeJob(prisma, job as Job<AnalyticsJob>, connection);
        }

        if (job.name === "wheel-detect") {
          return await handleWheelDetectJob(prisma, job as Job<AnalyticsJob>);
        }

        throw new Error(`Unknown job: ${job.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        const attempts = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade + 1 >= attempts;
        if (isFinalAttempt) {
          await analyticsDlq.add(
            job.name,
            { ...(job.data as AnalyticsJob), error: errorMessage },
            { jobId: `dlq:${job.id ?? job.name}:${Date.now()}` },
          );
        }

        throw err;
      }
    },
    { connection },
  );

  const newsWorker = new Worker(
    "news",
    async (job) => {
      try {
        if (job.name === "news-scan") {
          return await handleNewsScanJob(prisma, connection);
        }

        throw new Error(`Unknown job: ${job.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        const attempts = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade + 1 >= attempts;
        if (isFinalAttempt) {
          await newsDlq.add(job.name, { error: errorMessage }, { jobId: `dlq:${job.id ?? job.name}:${Date.now()}` });
        }

        throw err;
      }
    },
    { connection },
  );

  const alertsWorker = new Worker(
    "alerts",
    async (job) => {
      try {
        if (job.name === "alerts-evaluate") {
          return await handleAlertsEvaluateJob(prisma);
        }

        throw new Error(`Unknown job: ${job.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        const attempts = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade + 1 >= attempts;
        if (isFinalAttempt) {
          await alertsDlq.add(job.name, { error: errorMessage }, { jobId: `dlq:${job.id ?? job.name}:${Date.now()}` });
        }

        throw err;
      }
    },
    { connection },
  );

  const exportsWorker = new Worker(
    "exports",
    async (job) => {
      try {
        if (job.name === "export-run") {
          return await handleExportRunJob(prisma, job as Job<ExportsJob>, s3);
        }

        throw new Error(`Unknown job: ${job.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (job.name === "export-run") {
          const exportJobId = (job.data as ExportsJob).exportJobId;
          await prisma.exportJob
            .update({
              where: { id: exportJobId },
              data: { status: "failed", completedAt: new Date(), error: errorMessage },
            })
            .catch(() => {
              // ignore
            });

          const attempts = job.opts.attempts ?? 1;
          const isFinalAttempt = job.attemptsMade + 1 >= attempts;
          if (isFinalAttempt) {
            await exportsDlq.add(
              job.name,
              { ...(job.data as ExportsJob), error: errorMessage },
              { jobId: `dlq:${job.id ?? exportJobId}` },
            );
          }
        }

        throw err;
      }
    },
    { connection },
  );

  const shutdown = async () => {
    await exportsWorker.close();
    await alertsWorker.close();
    await newsWorker.close();
    await analyticsWorker.close();
    await worker.close();
    await syncQueue.close();
    await dlq.close();
    await analyticsQueue.close();
    await analyticsDlq.close();
    await newsQueue.close();
    await newsDlq.close();
    await alertsQueue.close();
    await alertsDlq.close();
    await exportsQueue.close();
    await exportsDlq.close();
    await connection.quit();
    await prisma.$disconnect();
  };

  process.on("SIGINT", () => {
    shutdown().catch((err) => console.error(err));
  });
  process.on("SIGTERM", () => {
    shutdown().catch((err) => console.error(err));
  });

  console.log("worker: started");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
