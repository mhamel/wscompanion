import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe("health", () => {
  it("returns ok", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it("returns a stable 404 error format", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/v1/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    await app.close();
  });
});
