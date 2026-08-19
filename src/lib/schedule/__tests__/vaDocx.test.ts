import { describe, it, expect } from "vitest";
import { parseDocxTableCells, cellGridToVaGrid } from "../vaDocx";
import { parseVaGrid } from "../vaGrid";

/**
 * VA .docx extraction acceptance. The parsers are pure, so they are tested against a hand-authored Word
 * table XML that reproduces the real structure — a title paragraph BEFORE the table (must be ignored), a
 * "Time | staff…" header, "On Duty" cells (including text split across runs, as Word often does), and blank
 * cells. The end-to-end assertion runs the extracted grid through parseVaGrid to shifts, proving the whole
 * .docx → shifts path, not just the XML step.
 */

const cell = (text: string) =>
  `<w:tc><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
// A cell whose text is split across two runs (Word does this constantly) — must still read as one string.
const splitOnDuty = `<w:tc><w:p><w:r><w:t>On </w:t></w:r><w:r><w:t>Duty</w:t></w:r></w:p></w:tc>`;
const blank = `<w:tc><w:p/></w:tc>`;
const row = (...cells: string[]) => `<w:tr>${cells.join("")}</w:tr>`;

const DOC_XML = `<?xml version="1.0"?><w:document><w:body>
  <w:p><w:r><w:t>VA Team Weekly Schedule</w:t></w:r></w:p>
  <w:tbl>
    ${row(cell("Time"), cell("Alex"), cell("Kaye"))}
    ${row(cell("10 AM - 12 PM"), splitOnDuty, blank)}
    ${row(cell("12 PM - 1 PM"), cell("On Duty"), blank)}
    ${row(cell("1 PM - 2 PM"), cell("On Duty"), cell("On Duty"))}
    ${row(cell("2 PM - 5 PM"), blank, cell("On Duty"))}
  </w:tbl>
</w:body></w:document>`;

describe("parseDocxTableCells", () => {
  it("extracts the table as a 2D cell grid, ignoring paragraphs outside the table", () => {
    const grid = parseDocxTableCells(DOC_XML);
    expect(grid[0]).toEqual(["Time", "Alex", "Kaye"]);
    expect(grid[1]).toEqual(["10 AM - 12 PM", "On Duty", ""]); // split runs joined → "On Duty"
    expect(grid).toHaveLength(5);
  });
  it("returns [] when there is no table", () => {
    expect(parseDocxTableCells("<w:document><w:body><w:p/></w:body></w:document>")).toEqual([]);
  });
});

describe("cellGridToVaGrid", () => {
  const grid = cellGridToVaGrid(parseDocxTableCells(DOC_XML));
  it("maps the header to staff and rows to On-Duty presence", () => {
    expect(grid.staff).toEqual(["Alex", "Kaye"]);
    expect(grid.rows[0]).toEqual({ block: "10 AM - 12 PM", onDuty: ["Alex"] });
    expect(grid.rows[2]).toEqual({ block: "1 PM - 2 PM", onDuty: ["Alex", "Kaye"] });
    expect(grid.rows[3]).toEqual({ block: "2 PM - 5 PM", onDuty: ["Kaye"] });
  });
});

describe(".docx → VaGrid → shifts (end-to-end)", () => {
  it("coalesces the extracted grid into per-staff shifts", () => {
    const res = parseVaGrid(cellGridToVaGrid(parseDocxTableCells(DOC_XML)));
    expect(res.shiftsByStaff["Alex"]).toEqual([{ start: "10:00", end: "14:00" }]); // 10-12,12-1,1-2 coalesced
    expect(res.shiftsByStaff["Kaye"]).toEqual([{ start: "13:00", end: "17:00" }]); // 1-2,2-5 coalesced
    expect(res.unparsedBlocks).toEqual([]);
  });
});
