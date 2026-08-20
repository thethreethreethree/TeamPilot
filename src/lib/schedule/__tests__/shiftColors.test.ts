import { describe, it, expect } from "vitest";
import { bandOf, bandFromLabel, BAND_STYLE, WORKED_BANDS } from "../shiftColors";

describe("bandOf (time-of-day classification)", () => {
  it("classifies by start hour", () => {
    expect(bandOf(6, false)).toBe("morning"); // opening
    expect(bandOf(9, false)).toBe("morning");
    expect(bandOf(11, false)).toBe("day"); // midday
    expect(bandOf(13, false)).toBe("day");
    expect(bandOf(15, false)).toBe("evening"); // closing
    expect(bandOf(19, false)).toBe("evening");
    expect(bandOf(21, false)).toBe("overnight"); // graveyard start
    expect(bandOf(2, false)).toBe("overnight"); // small hours
  });
  it("treats any midnight-crossing shift as overnight regardless of start", () => {
    expect(bandOf(21, true)).toBe("overnight"); // 21:00-06:00
    expect(bandOf(6, true)).toBe("overnight"); // a shift that wraps past midnight
  });
});

describe("bandFromLabel", () => {
  it("maps HH:mm-HH:mm labels to a band", () => {
    expect(bandFromLabel("06:00-15:00")).toBe("morning");
    expect(bandFromLabel("13:00-22:00")).toBe("day");
    expect(bandFromLabel("21:00-06:00")).toBe("overnight"); // crosses midnight (end <= start)
    expect(bandFromLabel("15:00-23:00")).toBe("evening");
  });
  it("returns null for a malformed label so the caller falls back to neutral", () => {
    expect(bandFromLabel("")).toBeNull();
    expect(bandFromLabel("9-5")).toBeNull();
    expect(bandFromLabel("morning")).toBeNull();
  });
});

describe("palette", () => {
  it("has a distinct fill for every band (color-coding is meaningful)", () => {
    const fills = Object.values(BAND_STYLE).map((s) => s.bg);
    expect(new Set(fills).size).toBe(fills.length);
  });
  it("lists the four worked bands in time-of-day order", () => {
    expect(WORKED_BANDS).toEqual(["morning", "day", "evening", "overnight"]);
  });
});
