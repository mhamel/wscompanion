import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

type RunOptions = { allowAlreadyExists?: boolean };

function runSentryCli(args: string[], options: RunOptions = {}): void {
  const isWindows = process.platform === "win32";
  const bin = isWindows ? "sentry-cli.cmd" : "sentry-cli";

  const result = spawnSync(bin, args, {
    shell: isWindows,
    env: process.env,
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) return;

  if (options.allowAlreadyExists && /already exists/i.test(`${result.stdout}\n${result.stderr}`)) {
    return;
  }

  throw new Error(`sentry-cli ${args.join(" ")} failed with exit code ${result.status}`);
}

function main() {
  requireEnv("SENTRY_AUTH_TOKEN");
  requireEnv("SENTRY_ORG");
  requireEnv("SENTRY_PROJECT");
  const release = requireEnv("SENTRY_RELEASE");

  const distDir = path.resolve("dist");
  if (!existsSync(distDir)) {
    throw new Error(
      `dist directory not found at ${distDir} (run "npm --workspace apps/backend run build")`,
    );
  }

  runSentryCli(["releases", "new", release], { allowAlreadyExists: true });
  runSentryCli([
    "sourcemaps",
    "upload",
    "--release",
    release,
    "--url-prefix",
    "~/dist",
    "--rewrite",
    distDir,
  ]);
  runSentryCli(["releases", "finalize", release], { allowAlreadyExists: true });
}

main();
