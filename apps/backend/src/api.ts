import "dotenv/config";
import "./observability/otel";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { createClient, type RedisClientType } from "redis";
import { buildServer } from "./server";
import { loadConfig } from "./config";
import { loadDevSecrets } from "./devSecrets";
import { createS3ExportsClient } from "./exports/s3";
import { captureException, closeSentry, initSentry } from "./observability/sentry";
import { shutdownOtel } from "./observability/otel";

async function main() {
  loadDevSecrets();
  initSentry();
  const config = loadConfig();
  const prisma = new PrismaClient();

  const bullConnection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const syncQueue = new Queue("sync", { connection: bullConnection });
  const analyticsQueue = new Queue("analytics", { connection: bullConnection });
  const exportsQueue = new Queue("exports", { connection: bullConnection });
  const s3Exports = createS3ExportsClient(config);

  let redis: RedisClientType | undefined;
  try {
    redis = createClient({ url: config.REDIS_URL });
    redis.on("error", (err) => {
      console.error(err);
    });
    await redis.connect();
  } catch (err) {
    console.error("redis: connection failed, continuing without cache", err);
    redis = undefined;
  }

  const app = buildServer({
    prisma,
    redis,
    syncQueue,
    analyticsQueue,
    exportsQueue,
    s3Exports: s3Exports ?? undefined,
  });
  app.addHook("onClose", async () => {
    try {
      await bullConnection.quit();
    } catch {
      // ignore
    }
  });

  const shutdown = async () => {
    try {
      await app.close();
    } catch {
      // ignore
    }
    await closeSentry();
    await shutdownOtel();
  };

  process.on("SIGINT", () => {
    shutdown().catch((err) => {
      console.error(err);
    });
  });
  process.on("SIGTERM", () => {
    shutdown().catch((err) => {
      console.error(err);
    });
  });

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch(async (err) => {
  captureException(err, { tags: { component: "api", phase: "startup" } });
  await closeSentry();
  await shutdownOtel();
  console.error(err);
  process.exit(1);
});
