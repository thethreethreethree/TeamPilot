import { describe, it, expect } from "vitest";
import { isIsoHeaderGrid, isoGridFromItems } from "../pdfIsoGrid";
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
