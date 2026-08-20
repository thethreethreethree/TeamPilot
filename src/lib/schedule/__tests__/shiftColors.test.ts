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

  // The founder's requirement is an EASY-TO-READ graphic (§1.5.4). The shift-time text sits on the band tint, so
  // it must stay legible — WCAG AA (4.5:1) for every band. This guards against a future colour tweak that looks
  // nice but makes a cell unreadable. (Colour is also redundant: every cell shows the time as text too.)
  it("keeps every band's text legible on its tint — WCAG AA (>= 4.5:1)", () => {
    const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const lum = (hex: string) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
    const contrast = (a: string, b: string) => { const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b)); return (hi + 0.05) / (lo + 0.05); };
    for (const [band, style] of Object.entries(BAND_STYLE)) {
      expect(contrast(style.fg, style.bg), `${band} text on tint`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
