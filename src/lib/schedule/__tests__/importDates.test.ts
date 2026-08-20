import { describe, it, expect } from "vitest";
import { findMonth, resolveHeaderDates, resolveGridDates } from "../importDates";

describe("findMonth", () => {
  it("finds a month name (full, abbreviated, dotted) anywhere in text", () => {
    expect(findMonth("AUGUST,16,17,18")).toBe(8);
    expect(findMonth("NAME,AUG.,AUG.")).toBe(8);
    expect(findMonth("SCHEDULE SEPTEMBER 2026")).toBe(9);
    expect(findMonth("no month here")).toBeNull();
  });
});

describe("resolveHeaderDates", () => {
  const today = "2026-08-21";
  it("resolves bare day numbers using a month hint + today's year; leaves TOTAL empty (HK.pdf shape)", () => {
    const hdr = ["16", "17", "18", "31", "TOTAL"];
    expect(resolveHeaderDates(hdr, 8, today)).toEqual(["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-31", ""]);
  });
  it("resolves 'AUG. 16' style month+day labels directly (HUB SCHED merged-header shape)", () => {
    expect(resolveHeaderDates(["AUG. 16", "AUG. 17", "AUGUST 31", "TOTAL"], null, today))
      .toEqual(["2026-08-16", "2026-08-17", "2026-08-31", ""]);
  });
  it("without a month hint, bare day numbers stay unresolved (honest '')", () => {
    expect(resolveHeaderDates(["16", "17"], null, today)).toEqual(["", ""]);
  });
  it("rolls the year so the month lands nearest today (Dec labels seen in Jan → previous year)", () => {
    expect(resolveHeaderDates(["3"], 12, "2026-01-05")).toEqual(["2025-12-03"]);
    expect(resolveHeaderDates(["3"], 1, "2026-12-28")).toEqual(["2027-01-03"]);
  });
});

describe("resolveGridDates (whole grid, month found in the header row)", () => {
  it("HK.pdf: month from the 'AUGUST' title cell, day numbers as columns", () => {
    const r = resolveGridDates(["16", "17", "31", "TOTAL"], "AUGUST,16,17,31,TOTAL", "2026-08-21");
    expect(r.anyResolved).toBe(true);
    expect(r.dates).toEqual(["2026-08-16", "2026-08-17", "2026-08-31", ""]);
  });
  it("returns anyResolved=false when nothing is a date (so the caller falls back to Analyze)", () => {
    expect(resolveGridDates(["Shift", "Role"], "Shift,Role", "2026-08-21").anyResolved).toBe(false);
  });
});
