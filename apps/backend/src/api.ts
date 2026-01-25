import dotenv from "dotenv";
import { buildServer } from "./server";
import { loadConfig } from "./config";

async function main() {
  dotenv.config();
  const config = loadConfig();
  const app = buildServer();

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
