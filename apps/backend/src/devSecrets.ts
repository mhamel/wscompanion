import fs from "node:fs";
import path from "node:path";

function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function resolveRepoRootPath(relativeFromRoot: string): string {
  // In this monorepo, backend cwd is usually `apps/backend`.
  // Repo root is `../../` from there.
  return path.resolve(process.cwd(), "..", "..", relativeFromRoot);
}

export function loadDevSecrets(): void {
  if ((process.env.NODE_ENV ?? "development") === "production") return;

  const snaptradePath = resolveRepoRootPath(".keys/snaptrade.txt");
  if (!fs.existsSync(snaptradePath)) return;

  const raw = fs.readFileSync(snaptradePath, "utf8");
  const lines = parseLines(raw);
  if (lines.length < 2) return;

  const [a, b] = lines;
  const clientId = a.length <= b.length ? a : b;
  const consumerKey = a.length <= b.length ? b : a;

  process.env.SNAPTRADE_CLIENT_ID ??= clientId;
  process.env.SNAPTRADE_CONSUMER_KEY ??= consumerKey;
}

