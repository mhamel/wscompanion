import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildServer } from "../server";

async function main() {
  const app = buildServer({ logger: false });
  await app.ready();

  // `@fastify/swagger` decorates `app.swagger()`.
  const spec = (app as unknown as { swagger: () => unknown }).swagger();

  const outPath = path.resolve(process.cwd(), "../../packages/contract/openapi.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(spec, null, 2), "utf8");

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
