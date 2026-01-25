import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createClient, type RedisClientType } from "redis";
import { buildServer } from "./server";
import { loadConfig } from "./config";

async function main() {
  dotenv.config();
  const config = loadConfig();
  const prisma = new PrismaClient();

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

  const app = buildServer({ prisma, redis });

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
