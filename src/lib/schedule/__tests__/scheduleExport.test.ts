import { describe, it, expect } from "vitest";
import { buildExportGrid, toAoa, gridToCsv } from "../scheduleExport";
import { parseCsvToGrid } from "../csvGrid";
import { parseScheduleGrid } from "../gridParser";
import { autoTimeRangeCodeMap } from "../importTime";
import type { Shift, Employee } from "../types";

const shift = (id: string, date: string, start: string, end: string, assigned: string[]): Shift =>
  ({ id, date, start, end, requiredHeadcount: 1, requiredByRole: {}, assigned, status: "published" });
const emp = (id: string, name: string, status: "active" | "inactive" = "active"): Employee =>
  ({ id, name, role: null, employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status } as unknown as Employee);

const ROSTER = [emp("a", "Alice"), emp("b", "Bob"), emp("c", "Cara")];
const SHIFTS = [
  shift("s1", "2026-08-17", "06:00", "15:00", ["a"]),
  shift("s2", "2026-08-17", "13:00", "22:00", ["b"]),
  shift("s3", "2026-08-18", "21:00", "06:00", ["a"]), // overnight
  shift("s4", "2026-08-19", "09:00", "18:00", ["b"]),
];

describe("buildExportGrid", () => {
  it("pivots shifts into a staff × date grid, cells as HH:mm-HH:mm, blanks for non-working", () => {
    const g = buildExportGrid(SHIFTS, ROSTER);
    expect(g.dates).toEqual(["2026-08-17", "2026-08-18", "2026-08-19"]);
    expect(g.rows.find((r) => r.name === "Alice")!.cells).toEqual(["06:00-15:00", "21:00-06:00", ""]);
    expect(g.rows.find((r) => r.name === "Bob")!.cells).toEqual(["13:00-22:00", "", "09:00-18:00"]);
    // Cara is active but unscheduled → present with all-blank (she exports so she can be filled in on re-import)
    expect(g.rows.find((r) => r.name === "Cara")!.cells).toEqual(["", "", ""]);
  });

  it("toAoa prepends the Name/date header row", () => {
    expect(toAoa(buildExportGrid(SHIFTS, ROSTER))[0]).toEqual(["Name", "2026-08-17", "2026-08-18", "2026-08-19"]);
  });
});

describe("ROUND-TRIP: export → CSV → import parsers → the same shifts", () => {
  it("re-imports to exactly the exported shifts, with NO manual code mapping (explicit times auto-map)", () => {
    const csv = gridToCsv(buildExportGrid(SHIFTS, ROSTER));

    // The import side, as the pipeline runs it:
    const { headerCells, rows } = parseCsvToGrid(csv);
    const headerDates = headerCells; // already ISO — no fuzzy resolution needed
    const codes = [...new Set(rows.flatMap((r) => r.cells).filter((c) => c.trim()))];
    const codeMap = autoTimeRangeCodeMap(codes); // deterministic — the round-trip needs no LLM/human step
    const parsed = parseScheduleGrid({ headerDates, rows, codeMap });

    expect(parsed.unknownCodes).toEqual([]); // every exported cell was recognized
    const shiftsBack = parsed.entries
      .filter((e) => e.kind === "shift")
      .map((e) => ({ name: e.employeeName, date: e.date, ...e.times }))
      .sort((x, y) => (x.name + x.date).localeCompare(y.name + y.date));

    expect(shiftsBack).toEqual([
      { name: "Alice", date: "2026-08-17", start: "06:00", end: "15:00" },
      { name: "Alice", date: "2026-08-18", start: "21:00", end: "06:00" },
      { name: "Bob", date: "2026-08-17", start: "13:00", end: "22:00" },
      { name: "Bob", date: "2026-08-19", start: "09:00", end: "18:00" },
    ]);
  });
});

describe("autoTimeRangeCodeMap (deterministic explicit-time recognition)", () => {
  it("maps explicit HH:mm ranges + OFF, leaves ambiguous org codes for the LLM/human", () => {
    const m = autoTimeRangeCodeMap(["06:00-15:00", "9:00am-5:00pm", "OFF", "6-3", "GY"]);
    expect(m["06:00-15:00"]).toEqual({ start: "06:00", end: "15:00" });
    expect(m["9:00am-5:00pm"]).toEqual({ start: "09:00", end: "17:00" });
    expect(m["OFF"]).toBe("off");
    expect(m["6-3"]).toBeUndefined(); // ambiguous (no colon) — NOT auto-mapped
    expect(m["GY"]).toBeUndefined();
  });
});
