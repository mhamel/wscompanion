#!/usr/bin/env node
/* eslint-disable no-console */

const DEFAULT_BASE = "http://localhost:3000";

function usage() {
  console.log("Probe backend endpoints: /v1/health, /v1/ready, /v1/version");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/dev/probe-backend.js [baseUrl]");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/dev/probe-backend.js");
  console.log("  node scripts/dev/probe-backend.js http://localhost:3000");
}

function stripTrailingSlashes(url) {
  return url.replace(/\/+$/, "");
}

async function fetchText(url) {
  const startedAt = Date.now();
  const res = await fetch(url);
  const text = await res.text();
  const ms = Date.now() - startedAt;
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // ignore
  }
  return { res, text, body, ms };
}

function snippet(body) {
  if (typeof body === "string") return body.slice(0, 400);
  try {
    return JSON.stringify(body, null, 2).slice(0, 600);
  } catch {
    return String(body).slice(0, 400);
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === "-h" || arg === "--help") {
    usage();
    process.exit(0);
  }

  const base = stripTrailingSlashes(arg || DEFAULT_BASE);
  const endpoints = [
    { name: "health", url: `${base}/v1/health` },
    { name: "ready", url: `${base}/v1/ready` },
    { name: "version", url: `${base}/v1/version` },
  ];

  console.log(`Base: ${base}`);

  let ok = true;
  for (const e of endpoints) {
    let r;
    try {
      r = await fetchText(e.url);
    } catch (err) {
      ok = false;
      console.log(`${e.name}: ERROR (network)`);
      console.log(String(err));
      continue;
    }

    const line = `${e.name}: ${r.res.status} ${r.res.ok ? "OK" : "ERROR"} (${r.ms}ms)`;
    console.log(line);

    if (e.name === "version" && r.body && typeof r.body === "object") {
      const nodeEnv = typeof r.body.nodeEnv === "string" ? r.body.nodeEnv : null;
      const gitSha = typeof r.body.gitSha === "string" ? r.body.gitSha : null;
      const release = typeof r.body.release === "string" ? r.body.release : null;
      const meta = [nodeEnv, gitSha, release].filter(Boolean).join(" / ");
      if (meta) console.log(`  ${meta}`);
    }

    if (!r.res.ok) {
      ok = false;
      console.log(`  ${snippet(r.body)}`);
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

