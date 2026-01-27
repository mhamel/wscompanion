import { describe, expect, it, vi } from "vitest";
import { sendExpoPushMessages, type ExpoPushMessage } from "./expoPush";

describe("sendExpoPushMessages", () => {
  it("returns invalid tokens for permanent token errors", async () => {
    const token = "ExponentPushToken[abc]";
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              status: "error",
              message: "not registered",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const res = await sendExpoPushMessages({
      messages: [{ to: token, title: "Alerte", body: "Test" } satisfies ExpoPushMessage],
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(res.invalidTokens).toEqual([token]);
  });

  it("chunks batches to 100 messages", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ data: Array(100).fill({ status: "ok", id: "x" }) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const messages: ExpoPushMessage[] = Array.from({ length: 101 }).map((_, i) => ({
      to: `ExponentPushToken[${i}]`,
      title: "Alerte",
      body: "Test",
    }));

    await sendExpoPushMessages({ messages, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
