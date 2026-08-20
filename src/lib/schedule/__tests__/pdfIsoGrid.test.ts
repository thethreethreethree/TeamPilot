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

  it("merges a TWO-ROW header + drops section-label rows + reunites wrapped codes (HUB SCHED.pdf shape)", () => {
    // Row layout (top→bottom): month row "NAME AUG. AUG.", day-number row (blank name) "16 17", a staffer,
    // a "PM SHIFT" divider (name, no data), a staffer with a wrapped "SKY-" code, its "BAR" continuation row.
    const page: PdfTextItem[] = [
      item("NAME", 20, 200), item("AUG.", 120, 200), item("AUG.", 220, 200),
      item("16", 120, 180), item("17", 220, 180), // day-number row, blank name column
      item("ALICE", 20, 160), item("6-3", 120, 160), item("6-3", 220, 160),
      item("PM SHIFT", 20, 140), // section divider: name only, no cells
      item("ABRIL", 20, 120), item("SKY-", 120, 120), item("2-11", 220, 120),
      item("BAR", 120, 100), // continuation of ABRIL's wrapped "SKY-BAR", blank name column
    ];
    const csv = pdfGridToCsv([page]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("NAME,AUG. 16,AUG. 17"); // two header rows merged → month+day per column
    const g = parseCsvToGrid(csv);
    expect(g.rows.map((r) => r.name)).toEqual(["ALICE", "ABRIL"]); // "PM SHIFT" divider dropped, no blank rows
    expect(g.rows.find((r) => r.name === "ABRIL")?.cells).toEqual(["SKY- BAR", "2-11"]); // wrapped code reunited
  });

  it("does NOT collide rows across pages that share a y-range (multi-page PDF — real schedules paginate)", () => {
    // Two pages, each with header y=500 + one staff row y=470. y RESETS per page, so a naive flatten-then-group
    // -by-y would merge page1's ALICE row with page2's BEN row. Rows must be grouped PER PAGE, in page order.
    const page1: PdfTextItem[] = [
      item("NAME", 30, 500), item("AUG 16", 150, 500), item("AUG 17", 270, 500),
      item("ALICE", 30, 470), item("6-3", 150, 470), item("6-3", 270, 470),
    ];
    const page2: PdfTextItem[] = [
      item("NAME", 30, 500), item("AUG 16", 150, 500), item("AUG 17", 270, 500),
      item("BEN", 30, 470), item("OFF", 150, 470), item("2-11", 270, 470),
    ];
    const csv = pdfGridToCsv([page1, page2]);
    const lines = csv.split("\n");
    // ALICE and BEN must be on their OWN lines with their OWN codes — not merged into one line.
    expect(lines).toContain("ALICE,6-3,6-3");
    expect(lines).toContain("BEN,OFF,2-11");
    expect(lines.some((l) => l.includes("ALICE") && l.includes("BEN"))).toBe(false); // not merged
    // The page-2 header repeat must NOT survive as a second data row (else it re-parses into a bogus "NAME"
    // staff member). Exactly ONE header line, and the parsed grid has only the two real people.
    expect(lines.filter((l) => l === "NAME,AUG 16,AUG 17").length).toBe(1);
    const g = parseCsvToGrid(csv);
    expect(g.rows.map((r) => r.name)).toEqual(["ALICE", "BEN"]); // no "NAME" ghost row
  });

  it("absorbs per-cell x-jitter AND keeps a multi-word name in one column (real-PDF robustness)", () => {
    // Columns ~29 / ~150 / ~270 / ~390 with ±6px jitter; a two-word name as one text run must stay one cell.
    const page: PdfTextItem[] = [
      item("NAME", 28, 500), item("AUG 16", 152, 500), item("AUG 17", 268, 500), item("AUG 18", 392, 500),
      item("CELESTINO MOLINA", 31, 470), item("6-3", 148, 470), item("6-3", 272, 470), item("OFF", 388, 470),
      item("ABRIL", 29, 440), item("OFF", 151, 440), item("2-11", 269, 440), item("2-11", 391, 440),
    ];
    const csv = pdfGridToCsv([page]);
    const g = parseCsvToGrid(csv);
    expect(g.headerCells).toEqual(["AUG 16", "AUG 17", "AUG 18"]);
    expect(g.rows.find((r) => r.name === "CELESTINO MOLINA")?.cells).toEqual(["6-3", "6-3", "OFF"]); // name not split
    expect(g.rows.find((r) => r.name === "ABRIL")?.cells).toEqual(["OFF", "2-11", "2-11"]);
  });
});
