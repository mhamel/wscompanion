import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { createClient, type RedisClientType } from "redis";
import { buildServer } from "./server";
import { loadConfig } from "./config";
import { loadDevSecrets } from "./devSecrets";

async function main() {
  dotenv.config();
  loadDevSecrets();
  const config = loadConfig();
  const prisma = new PrismaClient();

  const bullConnection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const syncQueue = new Queue("sync", { connection: bullConnection });
  const analyticsQueue = new Queue("analytics", { connection: bullConnection });

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

  const app = buildServer({ prisma, redis, syncQueue, analyticsQueue });
  app.addHook("onClose", async () => {
    try {
      await bullConnection.quit();
    } catch {
      // ignore
    }
  });

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
