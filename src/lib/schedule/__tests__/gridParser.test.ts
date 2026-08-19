import { describe, it, expect } from "vitest";
import { parseScheduleGrid, normalizeCode, type ShiftCodeMap } from "../gridParser";

/**
 * The file-upload grid parser (deterministic core, S3). Modeled on the real samples (HUB SCHED / frendz):
 * a staff x date grid of codes. What these lock: code normalization, mapping via a PARAMETER map (never
 * guessed), unknown codes SURFACED (not dropped/invented), and section separators (blank names) skipped.
 */

const MAP: ShiftCodeMap = {
  "6-3": { start: "06:00", end: "15:00" },
  "2-11": { start: "14:00", end: "23:00" },
  OFF: "off",
};

describe("normalizeCode", () => {
  it("collapses repeated dashes and upper-cases + trims", () => {
    expect(normalizeCode("1--10")).toBe("1-10");
    expect(normalizeCode("  off ")).toBe("OFF");
    expect(normalizeCode("6-3 bf")).toBe("6-3 BF");
  });
});

describe("parseScheduleGrid", () => {
  const headerDates = ["2026-08-16", "2026-08-17", "2026-08-18"];
  const rows = [
    { name: "ALICE", cells: ["6-3", "6-3", "OFF"] },
    { name: "PM SHIFT", cells: ["", "", ""] }, // a section separator row (blank-ish) — but has a name...
    { name: "ABRIL", cells: ["OFF", "2-11", "GY"] }, // GY is not in the map → unknown
  ];

  it("maps known codes to shifts/off and flags unknown codes", () => {
    const r = parseScheduleGrid({ headerDates, rows, codeMap: MAP });
    const alice = r.entries.filter((e) => e.employeeName === "ALICE");
    expect(alice[0]).toMatchObject({ date: "2026-08-16", kind: "shift", times: { start: "06:00", end: "15:00" } });
    expect(alice[2]).toMatchObject({ date: "2026-08-18", kind: "off" });
    const abril = r.entries.filter((e) => e.employeeName === "ABRIL");
    expect(abril[1]).toMatchObject({ kind: "shift", times: { start: "14:00", end: "23:00" } });
    expect(abril[2]).toMatchObject({ rawCode: "GY", kind: "unknown" });
    expect(r.unknownCodes).toContain("GY"); // surfaced, not dropped or guessed
  });

  it("includes each named row as staff (section separators handled by the caller marking blank names)", () => {
    const r = parseScheduleGrid({ headerDates, rows: [{ name: "  ", cells: ["6-3"] }, { name: "BOB", cells: ["6-3"] }], codeMap: MAP });
    expect(r.staff).toEqual(["BOB"]); // the blank-name separator row is skipped
  });

  it("an empty cell is 'empty', never a false shift", () => {
    const r = parseScheduleGrid({ headerDates: ["2026-08-16"], rows: [{ name: "CJ", cells: [""] }], codeMap: MAP });
    expect(r.entries[0]).toMatchObject({ kind: "empty" });
  });

  it("code lookup is case + dash insensitive (matches normalized map keys)", () => {
    const r = parseScheduleGrid({ headerDates: ["2026-08-16"], rows: [{ name: "D", cells: ["6--3"] }], codeMap: MAP });
    expect(r.entries[0]).toMatchObject({ kind: "shift", times: { start: "06:00", end: "15:00" } });
  });
});
