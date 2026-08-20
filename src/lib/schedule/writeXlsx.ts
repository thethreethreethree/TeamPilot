import JSZip from "jszip";

/**
 * Minimal, DEPENDENCY-FREE .xlsx writer (an .xlsx is a zip of OOXML; we already ship jszip). It writes cells as
 * INLINE strings (`t="inlineStr"`), so there is no shared-strings table to build AND the repo's own reader
 * (`xlsxSheetToCells`, which handles inlineStr) ingests it directly — the export round-trips through the same
 * import path as a real spreadsheet. The scaffolding parts ([Content_Types], _rels, workbook) make it a valid
 * workbook Excel/Sheets opens.
 *
 * `buildSheetXml` is pure + unit-tested (its round-trip against `xlsxSheetToCells` is the load-bearing check);
 * `buildXlsxBytes` is the thin zip wrapper.
 */

const xmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 0-based column index → A1 letters (0→A, 25→Z, 26→AA). */
export function colLetter(index: number): string {
  let s = "";
  let i = index + 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/** A 2D string grid → a worksheet XML body of inline-string cells. */
export function buildSheetXml(aoa: string[][]): string {
  const rowsXml = aoa
    .map((row, r) => {
      const cells = row
        .map((val, c) => `<c r="${colLetter(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val ?? "")}</t></is></c>`)
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const workbookXml = (sheetName: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

/** Build a complete .xlsx as bytes from a 2D grid. `sheetName` is capped at Excel's 31-char limit. */
export async function buildXlsxBytes(aoa: string[][], sheetName = "Schedule"): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("xl/workbook.xml", workbookXml(sheetName));
  zip.file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
  zip.file("xl/worksheets/sheet1.xml", buildSheetXml(aoa));
  return zip.generateAsync({ type: "uint8array" });
}
