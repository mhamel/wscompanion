import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { buildServer } from "./server";
import { loadConfig } from "./config";

async function main() {
  dotenv.config();
  const config = loadConfig();
  const prisma = new PrismaClient();
  const app = buildServer({ prisma });

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
