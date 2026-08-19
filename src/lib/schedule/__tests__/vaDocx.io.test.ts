import { describe, it, expect } from "vitest";
import { Document, Packer, Table, TableRow, TableCell, Paragraph } from "docx";
import { extractVaGridFromDocx } from "../vaDocx";
import { parseVaGrid } from "../vaGrid";
import { EmptyExtractionError } from "@/lib/documents/extractText";

/**
 * CI-gated end-to-end test for the .docx IO path (jszip unzip → word/document.xml → parse → VaGrid). The
 * pure XML parser is unit-tested against hand-written XML in vaDocx.test.ts, and the extractor was verified
 * against the founder's REAL file out-of-band — but the IO glue (unzipEntry + the real OOXML a Word writer
 * emits) had no CI coverage. Here the `docx` package (already a dependency) GENERATES a real .docx, which we
 * read back through extractVaGridFromDocx, so a regression in the unzip/parse seam fails CI.
 */

const cell = (text: string) => new TableCell({ children: [new Paragraph(text)] });
const row = (...texts: string[]) => new TableRow({ children: texts.map(cell) });

async function buildVaDocx(): Promise<Uint8Array> {
  const table = new Table({
    rows: [
      row("Time", "Alex", "Kaye"),
      row("10 AM - 12 PM", "On Duty", ""),
      row("12 PM - 1 PM", "On Duty", ""),
      row("1 PM - 2 PM", "On Duty", "On Duty"),
      row("2 PM - 5 PM", "", "On Duty"),
    ],
  });
  const doc = new Document({ sections: [{ children: [new Paragraph("VA Team Weekly Schedule"), table] }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

describe("extractVaGridFromDocx — real .docx IO round-trip (CI-gated)", () => {
  it("reads a generated Word table end-to-end and coalesces to shifts", async () => {
    const grid = await extractVaGridFromDocx(await buildVaDocx());
    expect(grid.staff).toEqual(["Alex", "Kaye"]);
    const res = parseVaGrid(grid);
    expect(res.shiftsByStaff["Alex"]).toEqual([{ start: "10:00", end: "14:00" }]); // 10-12,12-1,1-2 coalesced
    expect(res.shiftsByStaff["Kaye"]).toEqual([{ start: "13:00", end: "17:00" }]); // 1-2,2-5 coalesced
  });

  it("a .docx with no schedule table throws EmptyExtractionError (honest, not a silent empty)", async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph("just a memo, no table")] }] });
    const buf = new Uint8Array(await Packer.toBuffer(doc));
    await expect(extractVaGridFromDocx(buf)).rejects.toBeInstanceOf(EmptyExtractionError);
  });
});
