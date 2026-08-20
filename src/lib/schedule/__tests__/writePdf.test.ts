import { describe, it, expect } from "vitest";
import { buildImagePdf, buildTablePdf } from "../writePdf";
import { buildExportGrid } from "../scheduleExport";
import { isIsoHeaderGrid, isoGridFromItems } from "../pdfIsoGrid";
import { parseScheduleGrid } from "../gridParser";
import { autoTimeRangeCodeMap } from "../importTime";
import type { PdfTextItem } from "../staffDatePdf";
import type { Shift, Employee } from "../types";

const shift = (id: string, date: string, start: string, end: string, assigned: string[]): Shift =>
  ({ id, date, start, end, requiredHeadcount: 1, requiredByRole: {}, assigned, status: "published" });
const emp = (id: string, name: string): Employee =>
  ({ id, name, role: null, employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status: "active" } as unknown as Employee);

describe("buildImagePdf (visual)", () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  it("produces a valid single-page image PDF (legacy single-image call)", () => {
    const pdf = buildImagePdf(jpg, 800, 600);
    const body = String.fromCharCode(...pdf);
    expect(String.fromCharCode(...pdf.slice(0, 8))).toBe("%PDF-1.4");
    expect(body).toContain("/Filter /DCTDecode");
    expect(body).toContain("/MediaBox [0 0 842 595]"); // landscape
    expect(body).toContain("/Count 1");
    expect(String.fromCharCode(...pdf.slice(-6)).trim().endsWith("%%EOF")).toBe(true);
  });
  it("paginates multiple image pages (a tall 'all weeks' export → one page per band)", () => {
    const pdf = buildImagePdf([{ jpeg: jpg, w: 800, h: 500 }, { jpeg: jpg, w: 800, h: 500 }, { jpeg: jpg, w: 800, h: 300 }]);
    const body = String.fromCharCode(...pdf);
    expect(body).toContain("/Count 3");
    expect((body.match(/\/Subtype \/Image/g) ?? []).length).toBe(3);
    expect(String.fromCharCode(...pdf.slice(-6)).trim().endsWith("%%EOF")).toBe(true);
  });
  it("the multi-page structure LOADS in pdf.js with the right page count + landscape (object numbering is valid)", async () => {
    const pdf = buildImagePdf([{ jpeg: jpg, w: 800, h: 500 }, { jpeg: jpg, w: 800, h: 500 }]);
    const { getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(pdf);
    expect(doc.numPages).toBe(2);
    const page = await doc.getPage(2);
    expect(page.view[2]! > page.view[3]!).toBe(true); // landscape MediaBox
  });
});

describe("buildTablePdf → unpdf → ISO reader → parsers (DATA PDF re-import round-trip)", () => {
  it("re-imports to the exact exported shifts", async () => {
    const roster = [emp("a", "Alice"), emp("b", "Bob")];
    const shifts = [
      shift("s1", "2026-08-17", "06:00", "15:00", ["a"]),
      shift("s2", "2026-08-17", "13:00", "22:00", ["b"]),
      shift("s3", "2026-08-19", "21:00", "06:00", ["a"]),
    ];
    const grid = buildExportGrid(shifts, roster);
    const pdf = buildTablePdf(grid, "Frendz Cafe");

    const { extractTextItems } = await import("unpdf");
    const result = (await extractTextItems(pdf)) as { items?: PdfTextItem[][] | PdfTextItem[] };
    const raw = result.items ?? [];
    const pages: PdfTextItem[][] = Array.isArray(raw[0]) ? (raw as PdfTextItem[][]) : [raw as PdfTextItem[]];

    expect(isIsoHeaderGrid(pages)).toBe(true);
    const read = isoGridFromItems(pages);
    const codes = [...new Set(read.rows.flatMap((r) => r.cells).filter((c) => c.trim()))];
    const parsed = parseScheduleGrid({ headerDates: read.headerDates, rows: read.rows, codeMap: autoTimeRangeCodeMap(codes) });

    expect(parsed.unknownCodes).toEqual([]);
    const back = parsed.entries.filter((e) => e.kind === "shift").map((e) => `${e.employeeName} ${e.date} ${e.times!.start}-${e.times!.end}`).sort();
    expect(back).toEqual([
      "Alice 2026-08-17 06:00-15:00",
      "Alice 2026-08-19 21:00-06:00",
      "Bob 2026-08-17 13:00-22:00",
    ]);
  });
});
