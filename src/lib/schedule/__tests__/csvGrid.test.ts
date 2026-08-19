import { describe, it, expect } from "vitest";
import { splitCsvLine, parseCsvToGrid } from "../csvGrid";
import { parseScheduleGrid, type ShiftCodeMap } from "../gridParser";

describe("splitCsvLine (RFC-4180 minimal)", () => {
  it("splits plain fields + trims", () => expect(splitCsvLine("ALICE, 6-3 , OFF")).toEqual(["ALICE", "6-3", "OFF"]));
  it("honors quoted fields with embedded commas", () => {
    expect(splitCsvLine('"Smith, John",6-3,OFF')).toEqual(["Smith, John", "6-3", "OFF"]);
  });
  it("handles escaped quotes", () => expect(splitCsvLine('"a ""b"" c",x')).toEqual(['a "b" c', "x"]));
});

describe("parseCsvToGrid", () => {
  const csv = [
    "NAME,AUG 16,AUG 17,AUG 18",
    "ALICE,6-3,6-3,OFF",
    "PM SHIFT,,,", // section separator (blank name after col 0 label)
    "ABRIL,OFF,2-11,GY",
    "", // blank line skipped
  ].join("\n");

  it("extracts the header day-cells and the staff rows", () => {
    const g = parseCsvToGrid(csv);
    expect(g.headerCells).toEqual(["AUG 16", "AUG 17", "AUG 18"]);
    expect(g.rows.map((r) => r.name)).toEqual(["ALICE", "PM SHIFT", "ABRIL"]);
    expect(g.rows[0]?.cells).toEqual(["6-3", "6-3", "OFF"]);
  });
});

describe("CSV → grid → structured entries (the full deterministic upload path)", () => {
  it("composes parseCsvToGrid + parseScheduleGrid end to end", () => {
    const csv = ["NAME,d1,d2,d3", "ALICE,6-3,6-3,OFF", ",,,", "ABRIL,OFF,2-11,GY"].join("\n");
    const grid = parseCsvToGrid(csv);
    const map: ShiftCodeMap = { "6-3": { start: "06:00", end: "15:00" }, "2-11": { start: "14:00", end: "23:00" }, OFF: "off" };
    // header labels resolved to ISO dates by the (separate, human-confirmed) date step — supplied here.
    const parsed = parseScheduleGrid({
      headerDates: ["2026-08-16", "2026-08-17", "2026-08-18"],
      rows: grid.rows,
      codeMap: map,
    });
    expect(parsed.staff).toEqual(["ALICE", "ABRIL"]); // the blank-name separator row dropped
    expect(parsed.entries.find((e) => e.employeeName === "ALICE" && e.date === "2026-08-16")).toMatchObject({ kind: "shift" });
    expect(parsed.unknownCodes).toContain("GY"); // surfaced for the human to map, never guessed
  });
});
