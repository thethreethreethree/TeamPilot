import type { ExportGrid } from "./scheduleExport";

/**
 * Schedule Management System — DEPENDENCY-FREE PDF writers (a PDF is a simple object graph; no library needed).
 * Two variants the founder chose (2026-08-20):
 *   - buildImagePdf: the colour-coded schedule graphic on ONE landscape page (print/share; human view).
 *   - buildTablePdf: a positioned TEXT table (Helvetica) on landscape page(s) with an ISO-date header, so the
 *     PDF's text layer extracts back through `unpdf` → the generic ISO reader → parseScheduleGrid. Re-importable.
 *
 * Both are landscape A4 (842 × 595 pt). buildTablePdf paginates: dates into column-groups that fit the width and
 * rows into row-pages; the ISO reader merges the pages back by staff name (the same wrap-merge the frendz parser
 * does). Text placement uses an absolute text matrix (Tm) per cell so extraction sees a clean x/y grid.
 */

const LANDSCAPE = { w: 842, h: 595 } as const;

// ---- byte helpers (a PDF mixes ASCII structure with binary image streams) ----
function strBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}
function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Assemble numbered objects (bodies[i] = object i+1) into a valid PDF with an xref table + trailer. */
function assemblePdf(bodies: Uint8Array[], rootNum: number): Uint8Array {
  const header = strBytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const chunks: Uint8Array[] = [header];
  let offset = header.length;
  const offsets: number[] = [];
  bodies.forEach((body, i) => {
    const pre = strBytes(`${i + 1} 0 obj\n`);
    const post = strBytes("\nendobj\n");
    offsets.push(offset);
    chunks.push(pre, body, post);
    offset += pre.length + body.length + post.length;
  });
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${bodies.length + 1} /Root ${rootNum} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(strBytes(xref));
  return concat(chunks);
}

const pdfText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/**
 * A colour-coded schedule image (JPEG bytes at imgW×imgH px) → a single landscape-A4 PDF page, scaled to fit
 * with a margin, preserving aspect. Human view / print — NOT re-importable (it's an image).
 */
export function buildImagePdf(jpeg: Uint8Array, imgW: number, imgH: number): Uint8Array {
  const { w, h } = LANDSCAPE;
  const m = 24;
  const scale = Math.min((w - 2 * m) / imgW, (h - 2 * m) / imgH);
  const dw = imgW * scale, dh = imgH * scale;
  const tx = (w - dw) / 2, ty = (h - dh) / 2;
  const content = strBytes(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)} cm /Im0 Do Q`);

  const bodies: Uint8Array[] = [
    strBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    strBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    strBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concat([
      strBytes(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      strBytes("\nendstream"),
    ]),
    concat([strBytes(`<< /Length ${content.length} >>\nstream\n`), content, strBytes("\nendstream")]),
  ];
  return assemblePdf(bodies, 1);
}

const NAME_W = 130, MARGIN = 36, ROW_H = 18, COL_W = 52, TITLE = 30, HEADER = 54, BODY_TOP = 74;
const maxCols = () => Math.max(1, Math.floor((LANDSCAPE.w - 2 * MARGIN - NAME_W) / COL_W));
const maxRows = () => Math.max(1, Math.floor((LANDSCAPE.h - BODY_TOP - MARGIN) / ROW_H));
const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/**
 * A schedule grid → a positioned-text landscape PDF, re-importable via the generic ISO reader. Paginates dates
 * into column-groups (that fit the width) × rows into row-pages; every page repeats the Name column + its ISO
 * header so a page stands alone and the reader can merge by name.
 */
export function buildTablePdf(grid: ExportGrid, title: string): Uint8Array {
  const { w, h } = LANDSCAPE;
  const dateGroups = grid.dates.length ? chunk(grid.dates.map((d, i) => ({ d, i })), maxCols()) : [[]];
  const rowGroups = grid.rows.length ? chunk(grid.rows, maxRows()) : [[]];

  const contents: string[] = [];
  for (const dg of dateGroups) {
    for (const rg of rowGroups) {
      let c = `BT /F1 13 Tf 1 0 0 1 ${MARGIN} ${h - TITLE} Tm (${pdfText(title)}) Tj ET\n`;
      c += `BT /F1 8 Tf\n`;
      c += `1 0 0 1 ${MARGIN} ${h - HEADER} Tm (Name) Tj\n`;
      dg.forEach((col, ci) => {
        const x = MARGIN + NAME_W + ci * COL_W;
        c += `1 0 0 1 ${x} ${h - HEADER} Tm (${pdfText(col.d)}) Tj\n`;
      });
      rg.forEach((row, ri) => {
        const y = h - BODY_TOP - ri * ROW_H;
        c += `1 0 0 1 ${MARGIN} ${y} Tm (${pdfText(row.name)}) Tj\n`;
        dg.forEach((col, ci) => {
          const val = row.cells[col.i] ?? "";
          if (!val) return;
          const x = MARGIN + NAME_W + ci * COL_W;
          c += `1 0 0 1 ${x} ${y} Tm (${pdfText(val)}) Tj\n`;
        });
      });
      c += `ET`;
      contents.push(c);
    }
  }

  const k = contents.length;
  // obj 1 catalog, 2 pages, 3 font, pages 4..3+k, contents 4+k..3+2k
  const kids = Array.from({ length: k }, (_, i) => `${4 + i} 0 R`).join(" ");
  const bodies: Uint8Array[] = [
    strBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    strBytes(`<< /Type /Pages /Kids [${kids}] /Count ${k} >>`),
    strBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];
  for (let i = 0; i < k; i++) {
    bodies.push(strBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${4 + k + i} 0 R >>`));
  }
  for (let i = 0; i < k; i++) {
    const cb = strBytes(contents[i]!);
    bodies.push(concat([strBytes(`<< /Length ${cb.length} >>\nstream\n`), cb, strBytes("\nendstream")]));
  }
  return assemblePdf(bodies, 1);
}
