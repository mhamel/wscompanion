import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";
import { ingestTransactions, toJsonValue } from "./sync/ingestTransactions";

type SyncJob = {
  syncRunId: string;
  brokerConnectionId: string;
  userId: string;
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

async function main() {
  dotenv.config();
  const config = loadConfig();

  const prisma = new PrismaClient();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const syncQueue = new Queue("sync", { connection });
  const dlq = new Queue("sync-dlq", { connection });

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
          return await handleSyncJob(prisma, job as Job<SyncJob>, "initial");
        }

        if (job.name === "sync-incremental") {
          return await handleSyncJob(prisma, job as Job<SyncJob>, "incremental");
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

  const shutdown = async () => {
    await worker.close();
    await syncQueue.close();
    await dlq.close();
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
