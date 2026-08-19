/**
 * Schedule Management System — VA grid extraction from a .pdf (Phase 5 follow-up; R-VA-2 pdf half).
 *
 * A PDF has no table structure — only positioned glyphs. unpdf's plain `extractText` COLLAPSES the columns
 * ("5-8 AM On Duty" loses which staff column the mark is in), so it cannot recover WHO is on duty. But
 * `extractTextItems` exposes each run's (x, y): the "On Duty" marks land at the SAME x as their staff
 * header (verified against the founder's real VA_Weekly_Color_Grid.pdf — e.g. Joanne's header and her marks
 * are both x≈394.465). So we recover columns by matching each mark's x to the nearest header-name x.
 *
 * `pdfItemsToVaGrid` is PURE (positioned items → VaGrid) and unit-tested against the real file's actual
 * coordinates; `extractVaGridFromPdf` is the unpdf IO wrapper. The .docx remains canonical (explicit
 * meridiems + true table); the .pdf path is for when only the PDF is available.
 */
import type { VaGrid } from "./vaGrid";

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

interface Row {
  y: number;
  items: { str: string; x: number }[];
}

const isOnDuty = (s: string): boolean => /on\s*duty/i.test(s);

/** Cluster items into visual rows by y (PDF y grows upward; rows differ by the line height ~18). Items
 *  within `tol` of a row's y join it. Rows are returned top-to-bottom (y descending), items left-to-right. */
function groupRows(items: { str: string; x: number; y: number }[], tol = 4): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (row) row.items.push({ str: it.str, x: it.x });
    else rows.push({ y: it.y, items: [{ str: it.str, x: it.x }] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * Positioned PDF text items → VaGrid. Finds the header row (contains "Time"), reads the staff names +
 * their x-positions to its right, then for each lower row maps every "On Duty" mark to the nearest staff
 * column (within half the min column spacing, so a stray mark isn't force-assigned). The block label is
 * the text left of the first staff column. Returns an empty grid if no header is found.
 */
export function pdfItemsToVaGrid(items: PdfTextItem[]): VaGrid {
  const clean = items
    .map((i) => ({ str: i.str.replace(/\s+/g, " ").trim(), x: i.x, y: i.y }))
    .filter((i) => i.str.length > 0);
  const rows = groupRows(clean);

  const headerIdx = rows.findIndex((r) => r.items.some((it) => /^time$/i.test(it.str)));
  if (headerIdx < 0) return { staff: [], rows: [] };
  const header = rows[headerIdx]!;
  const timeItem = header.items.find((it) => /^time$/i.test(it.str))!;
  const staffItems = header.items.filter((it) => it.x > timeItem.x && !/^time$/i.test(it.str));
  const staff = staffItems.map((s) => s.str);
  const staffX = staffItems.map((s) => s.x);
  if (staff.length === 0) return { staff: [], rows: [] };

  // Column tolerance = half the smallest gap between adjacent staff columns (fallback 20).
  let minGap = Infinity;
  for (let i = 1; i < staffX.length; i++) minGap = Math.min(minGap, staffX[i]! - staffX[i - 1]!);
  const colTol = Number.isFinite(minGap) ? minGap / 2 : 20;
  const firstStaffX = staffX[0]!;

  const outRows: VaGrid["rows"] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]!;
    const block = row.items
      .filter((it) => it.x < firstStaffX - colTol)
      .map((it) => it.str)
      .join(" ")
      .trim();
    if (!block) continue;
    const onDuty: string[] = [];
    for (const it of row.items) {
      if (!isOnDuty(it.str)) continue;
      let best = -1;
      let bestD = Infinity;
      for (let s = 0; s < staffX.length; s++) {
        const d = Math.abs(it.x - staffX[s]!);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (best >= 0 && bestD <= colTol) onDuty.push(staff[best]!);
    }
    outRows.push({ block, onDuty });
  }
  return { staff, rows: outRows };
}

/** Read a .pdf buffer → VaGrid via unpdf's positioned extraction. Throws if no schedule table is found. */
export async function extractVaGridFromPdf(buffer: Uint8Array): Promise<VaGrid> {
  const { extractTextItems } = await import("unpdf");
  const result = (await extractTextItems(buffer)) as { items?: PdfTextItem[][] | PdfTextItem[] };
  const raw = result.items ?? [];
  // unpdf returns items per page (array of arrays) or flat depending on version — flatten defensively.
  const flat: PdfTextItem[] = Array.isArray(raw[0]) ? (raw as PdfTextItem[][]).flat() : (raw as PdfTextItem[]);
  const grid = pdfItemsToVaGrid(flat);
  if (grid.staff.length === 0 || grid.rows.length === 0) {
    const { EmptyExtractionError } = await import("@/lib/documents/extractText");
    throw new EmptyExtractionError("No schedule table was found in the .pdf.");
  }
  return grid;
}
