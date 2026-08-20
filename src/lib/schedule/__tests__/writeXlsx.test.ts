import { describe, it, expect } from "vitest";
import { buildSheetXml, buildXlsxBytes, colLetter } from "../writeXlsx";
import { xlsxSheetToCells, xlsxToCsv } from "../staffDateXlsx";
import { parseCsvToGrid } from "../csvGrid";
import { parseScheduleGrid } from "../gridParser";
import { autoTimeRangeCodeMap } from "../importTime";

describe("colLetter", () => {
  it("maps 0-based indexes to A1 letters", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(colLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
  });
});

const AOA = [
  ["Name", "2026-08-17", "2026-08-18"],
  ["Alice", "06:00-15:00", ""],
  ["Bob", "13:00-22:00", "09:00-18:00"],
];

describe("buildSheetXml → xlsxSheetToCells round-trip (the repo's own reader ingests our writer)", () => {
  it("survives a write→read cycle exactly (inline strings, no shared table)", () => {
    const cells = xlsxSheetToCells(buildSheetXml(AOA), []);
    expect(cells).toEqual(AOA);
  });
  it("XML-escapes special characters in a cell", () => {
    const xml = buildSheetXml([["A&B <x>", '"q"']]);
    expect(xlsxSheetToCells(xml, [])[0]).toEqual(["A&B <x>", '"q"']);
  });
});

describe("full .xlsx bytes → import reader → parsers (end-to-end round-trip)", () => {
  it("a written workbook re-imports to the same shifts with no manual mapping", async () => {
    const bytes = await buildXlsxBytes(AOA);
    const csv = await xlsxToCsv(bytes); // the real import reader (unzip + sheet parse)
    const { headerCells, rows } = parseCsvToGrid(csv);
    const codes = [...new Set(rows.flatMap((r) => r.cells).filter((c) => c.trim()))];
    const parsed = parseScheduleGrid({ headerDates: headerCells, rows, codeMap: autoTimeRangeCodeMap(codes) });
    expect(parsed.unknownCodes).toEqual([]);
    const back = parsed.entries.filter((e) => e.kind === "shift").map((e) => `${e.employeeName} ${e.date} ${e.times!.start}-${e.times!.end}`).sort();
    expect(back).toEqual([
      "Alice 2026-08-17 06:00-15:00",
      "Bob 2026-08-17 13:00-22:00",
      "Bob 2026-08-18 09:00-18:00",
    ]);
  });
});
