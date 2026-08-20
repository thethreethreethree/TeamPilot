import { describe, it, expect } from "vitest";
import { isIsoHeaderGrid, isoGridFromItems, pdfGridToCsv } from "../pdfIsoGrid";
import { parseCsvToGrid } from "../csvGrid";
import type { PdfTextItem } from "../staffDatePdf";

/**
 * The PDF import routes on isIsoHeaderGrid: ISO-header PDFs (our export) → the generic reader; everything else
 * (the founder's real "frendz" day-number/weekday layout) → the existing frendz parser. A FALSE POSITIVE here
 * would hijack the founder's real import and break it — so the load-bearing test is that a frendz-style page is
 * NOT mistaken for an ISO grid.
 */

const item = (str: string, x: number, y: number): PdfTextItem => ({ str, x, y });

describe("isIsoHeaderGrid — routing decision (must not hijack the frendz layout)", () => {
  it("TRUE for our ISO-date header (≥2 ISO dates in a row)", () => {
    const page = [item("Name", 36, 500), item("2026-08-17", 166, 500), item("2026-08-18", 218, 500)];
    expect(isIsoHeaderGrid([page])).toBe(true);
  });

  it("FALSE for the frendz layout — day numbers + weekday row, NO ISO dates (existing parser stays in control)", () => {
    const dayNums = [item("1", 160, 500), item("2", 210, 500), item("3", 260, 500)];
    const weekdays = [item("MON", 160, 484), item("TUE", 210, 484), item("WED", 260, 484)];
    const staff = [item("CELESTINO MOLINA", 20, 460), item("6-3", 160, 460), item("GY", 210, 460)];
    expect(isIsoHeaderGrid([dayNums, weekdays, staff])).toBe(false);
  });

  it("FALSE for a page with a single ISO date (not a header grid)", () => {
    expect(isIsoHeaderGrid([[item("Generated 2026-08-17", 36, 500)]])).toBe(false);
  });
});

describe("isoGridFromItems — reads an ISO grid", () => {
  it("pivots name + ISO columns into rows, cells at their anchors", () => {
    const header = [item("Name", 36, 500), item("2026-08-17", 166, 500), item("2026-08-18", 286, 500)];
    const alice = [item("Alice", 36, 480), item("06:00-15:00", 166, 480), item("13:00-22:00", 286, 480)];
    const bob = [item("Bob", 36, 460), item("21:00-06:00", 166, 460)];
    const g = isoGridFromItems([[...header, ...alice, ...bob]]);
    expect(g.headerDates).toEqual(["2026-08-17", "2026-08-18"]);
    expect(g.rows.find((r) => r.name === "Alice")!.cells).toEqual(["06:00-15:00", "13:00-22:00"]);
    expect(g.rows.find((r) => r.name === "Bob")!.cells).toEqual(["21:00-06:00", ""]);
  });

  it("merges paginated pages by staff name (unions date columns)", () => {
    const page1 = [item("Name", 36, 500), item("2026-08-17", 166, 500), item("Alice", 36, 480), item("06:00-15:00", 166, 480)];
    const page2 = [item("Name", 36, 500), item("2026-08-24", 166, 500), item("Alice", 36, 480), item("13:00-22:00", 166, 480)];
    const g = isoGridFromItems([page1, page2]);
    expect(g.headerDates).toEqual(["2026-08-17", "2026-08-24"]);
    expect(g.rows.find((r) => r.name === "Alice")!.cells).toEqual(["06:00-15:00", "13:00-22:00"]);
  });
});

describe("pdfGridToCsv — generic fallback for a non-frendz, non-ISO layout (the founder's 'AUG 16' grid)", () => {
  it("clusters positioned text into columns/rows → the CSV the Analyze flow can resolve", () => {
    // Header + two staff rows, one item per cell, at 4 column x's (~30 / 150 / 270 / 390).
    const page: PdfTextItem[] = [
      item("NAME", 30, 500), item("AUG 16", 150, 500), item("AUG 17", 270, 500), item("AUG 18", 390, 500),
      item("ALICE", 30, 470), item("6-3", 150, 470), item("6-3", 270, 470), item("OFF", 390, 470),
      item("ABRIL", 30, 440), item("OFF", 150, 440), item("2-11", 270, 440), item("2-11", 390, 440),
    ];
    const csv = pdfGridToCsv([page]);
    expect(csv).toBe("NAME,AUG 16,AUG 17,AUG 18\nALICE,6-3,6-3,OFF\nABRIL,OFF,2-11,2-11");
    // And it parses as a real staff×date grid the importer accepts.
    const g = parseCsvToGrid(csv);
    expect(g.headerCells).toEqual(["AUG 16", "AUG 17", "AUG 18"]);
    expect(g.rows.map((r) => r.name)).toEqual(["ALICE", "ABRIL"]);
  });

  it("merges a date label the PDF split into two close tokens ('AUG' + '16') within one column", () => {
    const page: PdfTextItem[] = [
      item("NAME", 30, 500), item("AUG", 150, 500), item("16", 162, 500), item("AUG", 270, 500), item("17", 282, 500),
      item("ALICE", 30, 470), item("6-3", 150, 470), item("6-3", 270, 470),
    ];
    const csv = pdfGridToCsv([page]);
    expect(csv).toBe("NAME,AUG 16,AUG 17\nALICE,6-3,6-3");
  });

  it("returns '' for an empty page (no false grid)", () => {
    expect(pdfGridToCsv([[]])).toBe("");
  });
});
