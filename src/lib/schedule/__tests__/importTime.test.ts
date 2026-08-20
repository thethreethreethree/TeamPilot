import { describe, it, expect } from "vitest";
import { to24h, normalizeCodeMap } from "../importTime";

/**
 * The fix for 4 failed imports: shift-code times came in as "1", "1:00pm", "13" etc., but preview/commit need
 * strict HH:mm. These lock the normalization so no time format can silently break the import again (A30).
 */
describe("to24h", () => {
  it("passes through valid 24h", () => {
    expect(to24h("13:00")).toBe("13:00");
    expect(to24h("06:30")).toBe("06:30");
    expect(to24h("00:00")).toBe("00:00");
  });
  it("converts 12-hour with am/pm", () => {
    expect(to24h("1:00pm")).toBe("13:00");
    expect(to24h("1:00 PM")).toBe("13:00");
    expect(to24h("9:00am")).toBe("09:00");
    expect(to24h("12:00am")).toBe("00:00"); // midnight
    expect(to24h("12:00pm")).toBe("12:00"); // noon
    expect(to24h("1pm")).toBe("13:00");
    expect(to24h("9 am")).toBe("09:00");
  });
  it("reads a bare hour literally, zero-padded", () => {
    expect(to24h("1")).toBe("01:00");
    expect(to24h("13")).toBe("13:00");
    expect(to24h("9")).toBe("09:00");
    expect(to24h("10")).toBe("10:00");
  });
  it("returns '' for the unparseable (so it fails visibly, not silently)", () => {
    expect(to24h("")).toBe("");
    expect(to24h("morning")).toBe("");
    expect(to24h("25")).toBe("");
    expect(to24h("13:99")).toBe("");
    expect(to24h("6-3")).toBe(""); // a shift code, not a time
  });
});

describe("normalizeCodeMap", () => {
  it("coerces every time to HH:mm, keeps off, drops unparseable codes", () => {
    expect(normalizeCodeMap({
      "1-10": { start: "1:00pm", end: "10:00pm" },
      "6-3": { start: "6", end: "3pm" },
      OFF: "off",
      BAD: { start: "morning", end: "17:00" }, // unparseable start → dropped
    })).toEqual({
      "1-10": { start: "13:00", end: "22:00" },
      "6-3": { start: "06:00", end: "15:00" },
      OFF: "off",
    });
  });
});
