/**
 * Schedule Management System — staff x date grid extraction from a .xlsx, DEPENDENCY-FREE.
 *
 * An .xlsx is a zip of XML (exactly like a .docx), so we read it with the same bomb-guarded `unzipEntry` and
 * parse the sheet XML directly — no SheetJS/xlsx dependency (which carries CVEs and would be a founder call).
 * A worksheet cell is `<c r="B3" t="s"><v>7</v></c>`: `t="s"` means `<v>` is an index into the shared-strings
 * table; `t="inlineStr"` carries `<is><t>…</t></is>`; otherwise `<v>` is the literal (number/date-serial).
 * We resolve each cell to text, place it at its A1 column, and hand the 2D grid to `docxCellsToCsv` so the
 * xlsx rides the SAME CSV import path as docx/pdf — dates + codes are human-confirmed (no unverified inference).
 *
 * Scope: the FIRST worksheet (xl/worksheets/sheet1.xml), the common single-sheet schedule. `parseSharedStrings`
 * + `xlsxSheetToCells` are PURE + unit-tested against hand-written XML; `xlsxToCsv` is the thin unzip wrapper.
 */
import { unzipEntry, EmptyExtractionError } from "@/lib/documents/extractText";
import { docxCellsToCsv } from "./staffDatePdf";

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&");
}
function cp(n: number): string {
  try { return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; } catch { return ""; }
}

/** A1 column letters → 0-based index (A→0, Z→25, AA→26). Falls back to 0 on malformed input. */
export function colIndexOf(ref: string): number {
  const m = /^([A-Za-z]+)/.exec(ref);
  if (!m?.[1]) return 0;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** xl/sharedStrings.xml → the ordered string table (each `<si>` = one string; its `<t>` runs concatenated). */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) {
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(m[1] ?? "")) !== null) text += tm[1] ?? "";
    out.push(decodeEntities(text));
  }
  return out;
}

/** A worksheet XML + the shared-strings table → a 2D cell grid (rows × columns, sparse cells filled ""). */
export function xlsxSheetToCells(sheetXml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheetXml)) !== null) {
    const cells: string[] = [];
    // A cell is either `<c …>…</c>` or a self-closing empty `<c …/>`.
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cRe.exec(rm[1] ?? "")) !== null) {
      const attrs = cm[1] ?? "";
      const inner = cm[2] ?? "";
      const refM = /r="([A-Za-z]+)\d+"/.exec(attrs);
      const col = refM ? colIndexOf(refM[1]!) : cells.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const vM = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
      let value = "";
      if (type === "s") {
        const idx = vM ? Number(vM[1]) : NaN;
        value = Number.isInteger(idx) ? (shared[idx] ?? "") : "";
      } else if (type === "inlineStr") {
        const isM = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(inner);
        value = isM ? decodeEntities(isM[1] ?? "") : "";
      } else {
        value = vM ? decodeEntities(vM[1] ?? "") : "";
      }
      while (cells.length < col) cells.push(""); // sparse fill up to this cell's column
      cells[col] = value.trim();
    }
    rows.push(cells);
  }
  return rows;
}

/** Read a .xlsx buffer → CSV text (first worksheet). Throws EmptyExtractionError if it carries no rows. */
export async function xlsxToCsv(buffer: Uint8Array): Promise<string> {
  const sheetXml = await unzipEntry(buffer, "xl/worksheets/sheet1.xml");
  let shared: string[] = [];
  try {
    shared = parseSharedStrings(await unzipEntry(buffer, "xl/sharedStrings.xml"));
  } catch {
    // No shared-strings part — a sheet with only inline/numeric cells. Fine; shared stays empty.
  }
  const cells = xlsxSheetToCells(sheetXml, shared);
  const csv = docxCellsToCsv(cells);
  if (!csv.trim()) throw new EmptyExtractionError("No rows were found in that .xlsx worksheet.");
  return csv;
}
