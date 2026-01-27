import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe("health", () => {
  it("returns ok", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/v1/health" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBeTruthy();
      expect(res.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  }, 15_000);

  it("returns a stable 404 error format", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/v1/nope" });
      expect(res.statusCode).toBe(404);
      expect(res.headers["x-request-id"]).toBeTruthy();
      expect(res.json()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    } finally {
      await app.close();
    }
  }, 15_000);

  it("propagates x-request-id when provided", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/health",
        headers: { "x-request-id": "test-request-id" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBe("test-request-id");
    } finally {
      await app.close();
    }
  }, 15_000);
});
