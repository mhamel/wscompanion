#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require("node:child_process");
const fs = require("node:fs");

function readJsonFile(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function readJsonFromGit(ref, path) {
  const content = execSync(`git show ${ref}:${path}`, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
  return JSON.parse(content);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getOperations(spec) {
  const paths = isObject(spec.paths) ? spec.paths : {};
  const ops = new Set();
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      if (isObject(pathItem[method])) {
        ops.add(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return ops;
}

function getSchemas(spec) {
  const components = isObject(spec.components) ? spec.components : {};
  const schemas = isObject(components.schemas) ? components.schemas : {};
  return new Set(Object.keys(schemas));
}

function main() {
  const headPath = "packages/contract/openapi.json";
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null;

  if (!baseRef) {
    console.log("openapi-breaking-check: no GITHUB_BASE_REF (not a PR) — skipping");
    process.exit(0);
  }

  let baseSpec;
  try {
    baseSpec = readJsonFromGit(baseRef, headPath);
  } catch (err) {
    console.error(`openapi-breaking-check: failed to read base spec from ${baseRef}:${headPath}`);
    console.error(String(err));
    process.exit(2);
  }

  const headSpec = readJsonFile(headPath);

  const baseOps = getOperations(baseSpec);
  const headOps = getOperations(headSpec);
  const removedOps = [...baseOps].filter((op) => !headOps.has(op));

  const baseSchemas = getSchemas(baseSpec);
  const headSchemas = getSchemas(headSpec);
  const removedSchemas = [...baseSchemas].filter((s) => !headSchemas.has(s));

  if (removedOps.length === 0 && removedSchemas.length === 0) {
    console.log("openapi-breaking-check: OK (no removed operations/schemas)");
    process.exit(0);
  }

  console.error("openapi-breaking-check: BREAKING changes detected");
  if (removedOps.length) {
    console.error(`- Removed operations (${removedOps.length}):`);
    for (const op of removedOps) console.error(`  - ${op}`);
  }
  if (removedSchemas.length) {
    console.error(`- Removed schemas (${removedSchemas.length}):`);
    for (const s of removedSchemas) console.error(`  - ${s}`);
  }

  process.exit(1);
}

main();

