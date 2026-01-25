import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";
import { ingestTransactions, toJsonValue } from "./sync/ingestTransactions";
import { computeTickerPnl360 } from "./analytics/pnl";
import { bumpPnlCacheVersion } from "./analytics/pnlCache";
import { loadDevSecrets } from "./devSecrets";

type SyncJob = {
  syncRunId: string;
  brokerConnectionId: string;
  userId: string;
};

type AnalyticsJob = {
  userId: string;
  symbol?: string;
};

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

async function main() {
  dotenv.config();
  loadDevSecrets();
  const config = loadConfig();

  const prisma = new PrismaClient();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const syncQueue = new Queue("sync", { connection });
  const dlq = new Queue("sync-dlq", { connection });
  const analyticsQueue = new Queue<AnalyticsJob>("analytics", { connection });
  const analyticsDlq = new Queue("analytics-dlq", { connection });

  const scheduleEverySeconds = Number(process.env.SYNC_SCHEDULE_EVERY_SECONDS ?? "3600");
  if (Number.isFinite(scheduleEverySeconds) && scheduleEverySeconds > 0) {
    await syncQueue.add(
      "sync-scan",
      {},
      { repeat: { every: scheduleEverySeconds * 1000 }, jobId: "sync-scan" },
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

  const shutdown = async () => {
    await analyticsWorker.close();
    await worker.close();
    await syncQueue.close();
    await dlq.close();
    await analyticsQueue.close();
    await analyticsDlq.close();
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
