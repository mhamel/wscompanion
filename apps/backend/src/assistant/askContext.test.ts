import { describe, expect, it } from "vitest";
import { extractSymbolFromMessageData, inferSymbolFromThreadMessages } from "./askContext";

describe("askContext", () => {
  it("extracts a normalized symbol from message data", () => {
    expect(extractSymbolFromMessageData({ symbol: " aapl " })).toBe("AAPL");
    expect(extractSymbolFromMessageData({ symbol: "" })).toBeNull();
    expect(extractSymbolFromMessageData(null)).toBeNull();
  });

  it("infers symbol from most recent messages", () => {
    const messages = [
      { data: { nope: true } },
      { data: { symbol: "TSLA" } },
      { data: { symbol: "AAPL" } },
    ];
    expect(inferSymbolFromThreadMessages(messages)).toBe("TSLA");
  });
});
