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

describe("ready", () => {
  it("returns 503 with checks when dependencies are not configured", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/v1/ready" });
      expect(res.statusCode).toBe(503);
      expect(res.headers["x-request-id"]).toBeTruthy();
      expect(res.json()).toEqual({
        ok: false,
        checks: {
          database: { ok: false, error: "not_configured" },
          redis: { ok: false, error: "not_configured" },
        },
      });
    } finally {
      await app.close();
    }
  }, 15_000);
});

describe("version", () => {
  it("returns ok and includes nodeEnv", async () => {
    const app = buildServer({ logger: false });
    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/v1/version" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBeTruthy();
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.json()).toMatchObject({ ok: true, nodeEnv: expect.any(String) });
    } finally {
      await app.close();
    }
  }, 15_000);
});

describe("cache-control", () => {
  it("sets private cache headers for generic /v1 GET routes", async () => {
    const app = buildServer({ logger: false });
    app.get(
      "/v1/test-cache",
      {
        schema: {
          response: {
            200: {
              type: "object",
              additionalProperties: false,
              properties: { ok: { type: "boolean" } },
              required: ["ok"],
            },
          },
        },
      },
      async () => ({ ok: true }),
    );

    await app.ready();
    try {
      const res = await app.inject({ method: "GET", url: "/v1/test-cache" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("private, max-age=30");
      expect(res.headers["vary"]).toBe("Authorization");
    } finally {
      await app.close();
    }
  }, 15_000);
});

describe("trustProxy", () => {
  it("uses x-forwarded-for for req.ip when TRUST_PROXY=true", async () => {
    const previous = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "true";

    const app = buildServer({ logger: false });
    app.get("/test-ip", async (req) => {
      return { ip: req.ip, ips: req.ips };
    });

    await app.ready();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/test-ip",
        headers: {
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().ip).toBe("203.0.113.10");
    } finally {
      await app.close();
      if (previous === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = previous;
      }
    }
  });
});
