/**
 * Schedule Management System — VA grid extraction from a .docx (Phase 5 follow-up; R-VA-2).
 *
 * The founder's canonical sample is VA_Weekly_Schedule.docx — a Word TABLE of time-block rows × staff
 * columns with "On Duty" cells. Unlike a scanned PDF, a .docx carries the table as structured XML
 * (`word/document.xml`), and its cells carry EXPLICIT meridiems ("10 AM - 12 PM"), so the .docx is the
 * reliable source (the .pdf shorthand is ambiguous — see `vaGrid.parseTimeBlock`).
 *
 * Split: `parseDocxTableCells` (XML → 2D cell grid) and `cellGridToVaGrid` (2D grid → VaGrid) are PURE and
 * unit-tested against a hand-written table XML; `extractVaGridFromDocx` is the thin IO wrapper (unzip via
 * the bomb-guarded `unzipEntry`). The parsed VaGrid feeds `vaGrid.parseVaGrid`.
 *
 * Scope: the FIRST table in the document (the VA doc has one). Nested tables are not handled (the VA format
 * has none); a cell's text is the concatenation of its runs, entity-decoded.
 */
import { unzipEntry, EmptyExtractionError } from "@/lib/documents/extractText";
import type { VaGrid } from "./vaGrid";

/** Decode the handful of XML entities that appear in Word run text. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}
function cp(n: number): string {
  try {
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

/** All `<w:t>` run text inside a fragment, concatenated + entity-decoded (a cell's runs → its text). */
function runText(fragment: string): string {
  let out = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) out += m[1];
  return decodeEntities(out).replace(/\s+/g, " ").trim();
}

/**
 * Parse the FIRST Word table into a 2D grid of cell texts. Pure. Returns [] when there is no table. Rows
 * are `<w:tr>`, cells are `<w:tc>`; each cell's text is the concatenation of its `<w:t>` runs.
 */
export function parseDocxTableCells(documentXml: string): string[][] {
  const tbl = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/.exec(documentXml);
  if (!tbl) return [];
  const body = tbl[1] ?? "";
  const grid: string[][] = [];
  const rowRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(body)) !== null) {
    const cells: string[] = [];
    const cellRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1] ?? "")) !== null) cells.push(runText(cm[1] ?? ""));
    grid.push(cells);
  }
  return grid;
}

const isOnDuty = (cell: string): boolean => /on\s*duty/i.test(cell);

/**
 * Map a 2D cell grid to a VaGrid. The HEADER is the row whose first cell reads "Time" (else the first row);
 * its remaining cells are the staff column names. Each later row is a time-block: first cell = the block
 * label, and a staff column whose cell says "On Duty" marks that staff on-duty for that block. Blank/short
 * rows are tolerated (a missing trailing cell = not on duty).
 */
export function cellGridToVaGrid(cells: string[][]): VaGrid {
  const rows = cells.filter((r) => r.length > 0);
  if (rows.length === 0) return { staff: [], rows: [] };
  const headerIdx = Math.max(0, rows.findIndex((r) => /^time$/i.test((r[0] ?? "").trim())));
  const header = rows[headerIdx] ?? [];
  const staff = header.slice(1).map((s) => s.trim()).filter((s) => s.length > 0);

  const outRows: VaGrid["rows"] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const block = (row[0] ?? "").trim();
    if (!block) continue;
    const onDuty: string[] = [];
    for (let c = 0; c < staff.length; c++) {
      const name = staff[c];
      if (name && isOnDuty(row[c + 1] ?? "")) onDuty.push(name);
    }
    outRows.push({ block, onDuty });
  }
  return { staff, rows: outRows };
}

/** Read a .docx buffer → VaGrid. Throws EmptyExtractionError if the doc carries no readable table. */
export async function extractVaGridFromDocx(buffer: Uint8Array): Promise<VaGrid> {
  const xml = await unzipEntry(buffer, "word/document.xml");
  const cells = parseDocxTableCells(xml);
  const grid = cellGridToVaGrid(cells);
  if (grid.staff.length === 0 || grid.rows.length === 0) {
    throw new EmptyExtractionError("No schedule table was found in the .docx.");
  }
  return grid;
}
