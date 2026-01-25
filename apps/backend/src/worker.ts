import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";

type SyncInitialJob = {
  syncRunId: string;
  brokerConnectionId: string;
  userId: string;
};

async function handleSyncInitialJob(prisma: PrismaClient, job: Job<SyncInitialJob>) {
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

  // TODO(BE-043/044): SnapTrade sync logic (transactions + positions + aggregates)
  const finishedAt = new Date();
  await prisma.syncRun.update({
    where: { id: syncRun.id },
    data: {
      status: "done",
      finishedAt,
      stats: { stub: true },
    },
  });

  return { ok: true };
}

async function main() {
  dotenv.config();
  const config = loadConfig();

  const prisma = new PrismaClient();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const dlq = new Queue("sync-dlq", { connection });

  const worker = new Worker(
    "sync",
    async (job) => {
      if (job.name !== "sync-initial") {
        throw new Error(`Unknown job: ${job.name}`);
      }

      try {
        return await handleSyncInitialJob(prisma, job as Job<SyncInitialJob>);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await prisma.syncRun.update({
          where: { id: (job.data as SyncInitialJob).syncRunId },
          data: { status: "failed", finishedAt: new Date(), error: errorMessage },
        });

        const attempts = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade + 1 >= attempts;
        if (isFinalAttempt) {
          await dlq.add(
            job.name,
            { ...(job.data as SyncInitialJob), error: errorMessage },
            { jobId: `dlq:${job.id ?? (job.data as SyncInitialJob).syncRunId}` },
          );
        }

        throw err;
      }
    },
    { connection },
  );

  const shutdown = async () => {
    await worker.close();
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
