import { describe, it, expect } from "vitest";
import { pdfItemsToVaGrid, type PdfTextItem } from "../vaPdf";
import { parseVaGrid } from "../vaGrid";

/**
 * VA .pdf extraction acceptance. The items below are the REAL (x, y) coordinates unpdf's extractTextItems
 * returns for the founder's VA_Weekly_Color_Grid.pdf — so this proves positional column recovery gets WHO
 * is on duty right (plain text collapses the columns and cannot). The end-to-end assertion matches the
 * .docx path exactly, confirming both file formats converge on the same shifts.
 */

// Real header x-positions from the file.
const X = { Time: 180.855, Alex: 248.425, Kaye: 297.105, Nikko: 345.785, Joanne: 394.465 };
const mk = (str: string, x: number, y: number): PdfTextItem => ({ str, x, y });

// Real row y-positions; each block label sits at X.Time, each "On Duty" at its staff column x.
const ROWS: { y: number; block: string; on: number[] }[] = [
  { y: 655, block: "5-8 AM", on: [X.Joanne] },
  { y: 637, block: "8-10 AM", on: [X.Nikko, X.Joanne] },
  { y: 619, block: "10-12 PM", on: [X.Alex, X.Nikko, X.Joanne] },
  { y: 601, block: "12-1 PM", on: [X.Alex, X.Joanne] },
  { y: 583, block: "1-2 PM", on: [X.Alex, X.Kaye] },
  { y: 565, block: "2-5 PM", on: [X.Kaye] },
  { y: 547, block: "5-7 PM", on: [] },
  { y: 529, block: "7-10 PM", on: [X.Alex] },
  { y: 511, block: "10-11 PM", on: [X.Alex, X.Kaye] },
  { y: 493, block: "11 PM-2 AM", on: [X.Kaye, X.Nikko] },
  { y: 475, block: "2-3 AM", on: [X.Nikko] },
  { y: 457, block: "3-5 AM", on: [] },
];

const ITEMS: PdfTextItem[] = [
  mk("VA Weekly Color-Coded Schedule", 160, 696), // title above the header — must be ignored
  mk("Time", X.Time, 673), mk("Alex", X.Alex, 673), mk("Kaye", X.Kaye, 673),
  mk("Nikko", X.Nikko, 673), mk("Joanne", X.Joanne, 673),
  ...ROWS.flatMap((r) => [mk(r.block, X.Time, r.y), ...r.on.map((x) => mk("On Duty", x, r.y))]),
];

describe("pdfItemsToVaGrid — real coordinates from the founder's PDF", () => {
  const grid = pdfItemsToVaGrid(ITEMS);
  it("recovers the staff columns and ignores the title above the header", () => {
    expect(grid.staff).toEqual(["Alex", "Kaye", "Nikko", "Joanne"]);
    expect(grid.rows).toHaveLength(12);
  });
  it("maps each On-Duty mark to the correct staff column by x-position", () => {
    expect(grid.rows[0]).toEqual({ block: "5-8 AM", onDuty: ["Joanne"] });
    expect(grid.rows[2]).toEqual({ block: "10-12 PM", onDuty: ["Alex", "Nikko", "Joanne"] });
    expect(grid.rows[9]).toEqual({ block: "11 PM-2 AM", onDuty: ["Kaye", "Nikko"] });
  });
});

describe(".pdf → VaGrid → shifts (matches the .docx path exactly)", () => {
  it("coalesces to the same per-staff shifts as the docx", () => {
    const res = parseVaGrid(pdfItemsToVaGrid(ITEMS));
    expect(res.shiftsByStaff["Alex"]).toEqual([{ start: "10:00", end: "14:00" }, { start: "19:00", end: "23:00" }]);
    expect(res.shiftsByStaff["Kaye"]).toEqual([{ start: "13:00", end: "17:00" }, { start: "22:00", end: "02:00" }]);
    expect(res.shiftsByStaff["Nikko"]).toEqual([{ start: "08:00", end: "12:00" }, { start: "23:00", end: "03:00" }]);
    expect(res.shiftsByStaff["Joanne"]).toEqual([{ start: "05:00", end: "13:00" }]);
    expect(res.unparsedBlocks).toEqual([]);
  });
});
