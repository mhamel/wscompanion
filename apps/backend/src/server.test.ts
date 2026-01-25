import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe("health", () => {
  it("returns ok", async () => {
    const app = buildServer();
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});
