import { describe, it, expect } from "vitest";
import { colIndexOf, parseSharedStrings, xlsxSheetToCells } from "../staffDateXlsx";

/**
 * Dependency-free .xlsx reading (a zip of XML, like .docx). Locks the pieces that turn worksheet XML +
 * shared strings into a 2D cell grid: A1 column math, shared-string resolution, inline strings, numeric
 * cells, and SPARSE cells (a skipped column must not shift the others left). The grid then rides the same
 * docxCellsToCsv → CSV import path (human-confirmed), so no live .xlsx sample is needed to be safe.
 */

describe("colIndexOf", () => {
  it("maps A1 column letters to 0-based indices", () => {
    expect(colIndexOf("A1")).toBe(0);
    expect(colIndexOf("B3")).toBe(1);
    expect(colIndexOf("Z9")).toBe(25);
    expect(colIndexOf("AA1")).toBe(26);
    expect(colIndexOf("AB12")).toBe(27);
  });
});

describe("parseSharedStrings", () => {
  it("returns the ordered string table, decoding entities + concatenating runs", () => {
    const xml = `<sst><si><t>NAME</t></si><si><t>AUG </t><t>16</t></si><si><t>6 &amp; 3</t></si></sst>`;
    expect(parseSharedStrings(xml)).toEqual(["NAME", "AUG 16", "6 & 3"]);
  });
});

describe("xlsxSheetToCells", () => {
  const shared = ["NAME", "AUG 16", "AUG 17", "ALICE", "6-3", "OFF"];

  it("resolves shared-string cells into a 2D grid", () => {
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
      <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c></row>
    </sheetData></worksheet>`;
    expect(xlsxSheetToCells(sheet, shared)).toEqual([
      ["NAME", "AUG 16", "AUG 17"],
      ["ALICE", "6-3", "OFF"],
    ]);
  });

  it("handles inline strings, numeric cells, and SPARSE cells (a skipped column stays a blank, not a shift)", () => {
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>BOB</t></is></c><c r="C1"><v>42</v></c></row>
    </sheetData></worksheet>`;
    // B1 is absent → column index 1 must be "" so "42" stays in column 2 (C), not shifted to B.
    expect(xlsxSheetToCells(sheet, shared)).toEqual([["BOB", "", "42"]]);
  });

  it("tolerates self-closing empty cells", () => {
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c><c r="B1"/></row></sheetData></worksheet>`;
    expect(xlsxSheetToCells(sheet, shared)).toEqual([["ALICE", ""]]);
  });

  it("bounds a far-right cell ref — a row cannot amplify into a 16k-element array (Finding F2)", () => {
    // A crafted cell at r="XFD1" is column 16383; without the cap the row back-fills 16k empty strings, exhausting
    // memory across many rows. The cell beyond the cap is dropped; A1 still resolves normally.
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c><c r="XFD1" t="s"><v>0</v></c></row></sheetData></worksheet>`;
    const cells = xlsxSheetToCells(sheet, shared);
    expect(cells[0]![0]).toBe("ALICE"); // A1 kept
    expect(cells[0]!.length).toBeLessThanOrEqual(257); // NOT ~16384 — the far-right cell was bounded
  });
});
