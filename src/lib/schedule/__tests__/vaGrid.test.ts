import { describe, it, expect } from "vitest";
import { parseTimeBlock, coalesceRanges, parseVaGrid, type VaGrid } from "../vaGrid";

/**
 * VA presence-grid parser acceptance. The integration test runs the founder's ACTUAL sample
 * (VA_Weekly_Schedule.docx / VA_Weekly_Color_Grid.pdf — Alex/Kaye/Nikko/Joanne) through the parser and
 * asserts the coalesced shifts, so this is a real-input effectivity check (1.5.1 layer 2), not a synthetic
 * fixture. The subtle case it pins: an overnight run ("11 PM-2 AM" + "2-3 AM") coalesces ACROSS midnight
 * because the grid's day cycles 5 AM → next-day 5 AM — sorting by absolute clock would wrongly split it.
 */

describe("parseTimeBlock", () => {
  it("explicit both-sides (.docx form)", () => {
    expect(parseTimeBlock("5 AM - 8 AM")).toEqual({ start: "05:00", end: "08:00" });
    expect(parseTimeBlock("10 AM - 12 PM")).toEqual({ start: "10:00", end: "12:00" });
    expect(parseTimeBlock("12 PM - 1 PM")).toEqual({ start: "12:00", end: "13:00" });
    expect(parseTimeBlock("11 PM - 2 AM")).toEqual({ start: "23:00", end: "02:00" }); // crosses midnight
    expect(parseTimeBlock("12 AM - 1 AM")).toEqual({ start: "00:00", end: "01:00" }); // midnight = 00:00
  });
  it("shorthand end-only-meridiem (.pdf form)", () => {
    expect(parseTimeBlock("5-8 AM")).toEqual({ start: "05:00", end: "08:00" });
    expect(parseTimeBlock("10-12 PM")).toEqual({ start: "10:00", end: "12:00" }); // start inferred AM (< 12)
    expect(parseTimeBlock("11 PM-2 AM")).toEqual({ start: "23:00", end: "02:00" });
  });
  it("honors minutes and en/em dashes", () => {
    expect(parseTimeBlock("5:30 AM - 6:00 AM")).toEqual({ start: "05:30", end: "06:00" });
    expect(parseTimeBlock("5 AM – 8 AM")).toEqual({ start: "05:00", end: "08:00" }); // en dash
  });
  it("malformed / no meridiem → null, never throws", () => {
    expect(parseTimeBlock("")).toBeNull();
    expect(parseTimeBlock("On Duty")).toBeNull();
    expect(parseTimeBlock("5-8")).toBeNull(); // no meridiem anywhere → unresolvable
    expect(parseTimeBlock("13 AM - 14 AM")).toBeNull(); // 12h clock only
  });
});

describe("coalesceRanges (cycle/row order)", () => {
  it("merges touching blocks into one shift", () => {
    expect(coalesceRanges([{ start: "10:00", end: "12:00" }, { start: "12:00", end: "13:00" }])).toEqual([
      { start: "10:00", end: "13:00" },
    ]);
  });
  it("splits on a gap", () => {
    expect(coalesceRanges([{ start: "10:00", end: "12:00" }, { start: "19:00", end: "22:00" }])).toEqual([
      { start: "10:00", end: "12:00" },
      { start: "19:00", end: "22:00" },
    ]);
  });
  it("coalesces an overnight run ACROSS midnight (11 PM-2 AM + 2-3 AM → 23:00-03:00)", () => {
    expect(coalesceRanges([{ start: "23:00", end: "02:00" }, { start: "02:00", end: "03:00" }])).toEqual([
      { start: "23:00", end: "03:00" },
    ]);
  });
});

// The founder's real weekday grid (rows in cycle order 5 AM → next-day 5 AM), explicit .docx notation.
const VA_SAMPLE: VaGrid = {
  staff: ["Alex", "Kaye", "Nikko", "Joanne"],
  rows: [
    { block: "5 AM - 8 AM", onDuty: ["Joanne"] },
    { block: "8 AM - 10 AM", onDuty: ["Nikko", "Joanne"] },
    { block: "10 AM - 12 PM", onDuty: ["Alex", "Nikko", "Joanne"] },
    { block: "12 PM - 1 PM", onDuty: ["Alex", "Joanne"] },
    { block: "1 PM - 2 PM", onDuty: ["Alex", "Kaye"] },
    { block: "2 PM - 5 PM", onDuty: ["Kaye"] },
    { block: "5 PM - 7 PM", onDuty: [] },
    { block: "7 PM - 10 PM", onDuty: ["Alex"] },
    { block: "10 PM - 11 PM", onDuty: ["Alex", "Kaye"] },
    { block: "11 PM - 2 AM", onDuty: ["Kaye", "Nikko"] },
    { block: "2 AM - 3 AM", onDuty: ["Nikko"] },
    { block: "3 AM - 5 AM", onDuty: [] },
  ],
};

describe("parseVaGrid — the founder's real VA sample (1.5.1 layer-2 effectivity)", () => {
  const res = parseVaGrid(VA_SAMPLE);
  it("coalesces each staff's contiguous On-Duty blocks into shifts", () => {
    expect(res.shiftsByStaff["Alex"]).toEqual([{ start: "10:00", end: "14:00" }, { start: "19:00", end: "23:00" }]);
    expect(res.shiftsByStaff["Kaye"]).toEqual([{ start: "13:00", end: "17:00" }, { start: "22:00", end: "02:00" }]);
    expect(res.shiftsByStaff["Nikko"]).toEqual([{ start: "08:00", end: "12:00" }, { start: "23:00", end: "03:00" }]);
    expect(res.shiftsByStaff["Joanne"]).toEqual([{ start: "05:00", end: "13:00" }]);
  });
  it("reports no unparsed blocks for the clean sample", () => {
    expect(res.unparsedBlocks).toEqual([]);
  });
  it("surfaces an unparseable block that has On-Duty marks, never silently drops it", () => {
    const bad = parseVaGrid({ staff: ["Alex"], rows: [{ block: "sometime evening", onDuty: ["Alex"] }] });
    expect(bad.unparsedBlocks).toEqual(["sometime evening"]);
    expect(bad.shiftsByStaff["Alex"]).toEqual([]);
  });
});
