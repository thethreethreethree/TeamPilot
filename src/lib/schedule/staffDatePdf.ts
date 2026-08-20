/**
 * Schedule Management System — staff x date shift-code grid extraction from a .pdf (Phase 5 follow-up).
 *
 * The founder's real "frendz" schedule is a different PDF layout than the VA "On Duty" presence grid: staff
 * down the LEFT, DATES across the top (a day-number row + a weekday row), and shift CODES in the cells
 * ("1--10", "6--3", "GY", "OFF", "6-3 BF"). It converges on the SAME downstream as the CSV importer —
 * `parseScheduleGrid` (the code map is confirmed by a human, never guessed) → `planImport` — so this file's
 * only job is the format-specific extraction: positioned PDF glyphs → `{ staff, headerDates, rows }`.
 *
 * The real file (verified against its actual coordinates in staffDatePdf.test.ts) is adversarial:
 *   - TWO cut-off blocks stacked per page ("SEPTEMBER 1-15", "AUGUST 16-30"), each with an explicit month/year
 *     in its title, so dates are resolved DETERMINISTICALLY (day number + title month/year), not by an LLM.
 *   - Each block WRAPS: the first date-columns appear with the staff NAMES; the remaining date-columns render
 *     as a separate page-block with the name column DROPPED (codes start where the names were).
 *   - Vertical OVERFLOW: a block's staff rows that don't fit continue, header-less, on the next page.
 *
 * The assembly invariants that make this tractable (all hold in the real file):
 *   1. Staff appear in the SAME ORDER in every column-set (so a nameless continuation row maps to the roster
 *      by position).
 *   2. A header (a day-number row + a weekday row) starts a new column-set; the block's month/year is the most
 *      recent title above it.
 *   3. Header-less rows continue the current column-set (the overflow case).
 *   4. Cells align to the WEEKDAY row's x-positions (the day-number row is offset), so columns are anchored on
 *      the weekday x and the i-th day number pairs with the i-th weekday by order.
 */

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

export interface StaffDateGrid {
  staff: string[];
  /** ISO dates (YYYY-MM-DD), sorted ascending, unioned across all blocks. */
  headerDates: string[];
  /** One row per staff member, cells aligned index-for-index with headerDates ("" where none). */
  rows: { name: string; cells: string[] }[];
}

const MONTHS: Record<string, number> = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};
const WEEKDAYS = new Set(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);

interface Row {
  y: number;
  items: { str: string; x: number }[];
}

/** Cluster positioned items into visual rows by y (PDF y grows upward), top-to-bottom, items left-to-right. */
function groupRows(items: PdfTextItem[], tol = 4): Row[] {
  const clean = items
    .map((i) => ({ str: i.str.replace(/\s+/g, " ").trim(), x: i.x, y: i.y }))
    .filter((i) => i.str.length > 0);
  const sorted = [...clean].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (row) row.items.push({ str: it.str, x: it.x });
    else rows.push({ y: it.y, items: [{ str: it.str, x: it.x }] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** A block title like "SCHEDULE CUT OFF (SEPTEMBER 1-15 2026)" → month (1-12) + year. The leading "S" is
 *  sometimes clipped in the PDF ("CHEDULE…"), so we match on the month name + year, not the word "SCHEDULE". */
function parseTitle(text: string): { month: number; year: number } | null {
  const up = text.toUpperCase();
  if (!/CHEDULE\s+CUT\s*OFF/.test(up)) return null;
  const monthMatch = up.match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/);
  const yearMatch = up.match(/\b(20\d{2})\b/);
  if (!monthMatch || !yearMatch) return null;
  return { month: MONTHS[monthMatch[1]!]!, year: Number(yearMatch[1]) };
}

const isDayNum = (s: string) => /^\d{1,2}$/.test(s.trim());
const isWeekday = (s: string) => WEEKDAYS.has(s.trim().toUpperCase());

/** Fraction of a row's items matching a predicate — used to classify a row as day-number / weekday. */
function fractionMatching(row: Row, pred: (s: string) => boolean): number {
  if (row.items.length === 0) return 0;
  return row.items.filter((it) => pred(it.str)).length / row.items.length;
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface ColumnSet {
  dates: string[]; // ISO per column, in x-order
  anchors: number[]; // weekday-row x per column
  filled: number; // staff rows assigned so far
}

/**
 * Positioned PDF items (one array per page, in page order) → a merged staff x date grid. Returns an empty
 * grid (staff: []) when no schedule header is found, so the IO wrapper can raise the same "no table" error the
 * VA path does.
 */
export function pdfItemsToStaffDateGrid(pages: PdfTextItem[][]): StaffDateGrid {
  const roster: string[] = [];
  const rosterKey = new Set<string>();
  const cells = new Map<string, Map<string, string>>(); // name -> (iso -> rawCode)
  const allDates = new Set<string>();

  let pendingTitle: { month: number; year: number } | null = null;
  let pendingDayNums: number[] | null = null;
  let current: ColumnSet | null = null;

  const ensureStaff = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    if (!rosterKey.has(key)) { rosterKey.add(key); roster.push(name.trim()); }
    if (!cells.has(name.trim())) cells.set(name.trim(), new Map());
  };

  for (const page of pages) {
    for (const row of groupRows(page)) {
      const joined = row.items.map((i) => i.str).join(" ");

      // 1) Title row — sets the month/year for the next column-set.
      const title = parseTitle(joined);
      if (title) { pendingTitle = title; continue; }

      // 2) Day-number row — stash the day numbers (paired with the weekday row that follows).
      if (fractionMatching(row, isDayNum) >= 0.5) {
        pendingDayNums = row.items.filter((it) => isDayNum(it.str)).map((it) => Number(it.str));
        continue;
      }

      // 3) Weekday row — pair with the stashed day numbers + the pending title → a new column-set.
      if (fractionMatching(row, isWeekday) >= 0.5) {
        const weekdayItems = row.items.filter((it) => isWeekday(it.str));
        if (pendingTitle && pendingDayNums && pendingDayNums.length === weekdayItems.length && weekdayItems.length > 0) {
          const dates = pendingDayNums.map((d) => isoOf(pendingTitle!.year, pendingTitle!.month, d));
          current = { dates, anchors: weekdayItems.map((it) => it.x), filled: 0 };
          dates.forEach((d) => allDates.add(d));
        } else {
          current = null; // malformed header — don't misattribute the rows under it
        }
        pendingDayNums = null;
        continue;
      }

      // 4) Otherwise a staff/data row — attribute to the current column-set.
      if (!current) continue;
      const anchor0 = current.anchors[0]!;
      const tol = columnTol(current.anchors);
      const nameItems = row.items.filter((it) => it.x < anchor0 - tol);
      const cellItems = row.items.filter((it) => it.x >= anchor0 - tol);
      if (cellItems.length === 0) continue; // nothing to place (a stray note)

      let name = nameItems.map((it) => it.str).join(" ").trim();
      if (name) {
        ensureStaff(name);
      } else {
        // Nameless continuation row → the roster member at this column-set's fill position.
        name = roster[current.filled] ?? "";
        if (!name) { current.filled++; continue; } // no roster slot known yet — skip defensively
      }

      // Place each cell at its nearest column anchor.
      const target = cells.get(name.trim());
      if (target) {
        for (const it of cellItems) {
          let best = -1, bestD = Infinity;
          for (let c = 0; c < current.anchors.length; c++) {
            const d = Math.abs(it.x - current.anchors[c]!);
            if (d < bestD) { bestD = d; best = c; }
          }
          if (best >= 0 && bestD <= tol) target.set(current.dates[best]!, it.str);
        }
      }
      current.filled++;
    }
  }

  if (roster.length === 0 || allDates.size === 0) return { staff: [], headerDates: [], rows: [] };

  const headerDates = [...allDates].sort();
  const rows = roster.map((name) => {
    const map = cells.get(name) ?? new Map<string, string>();
    return { name, cells: headerDates.map((d) => map.get(d) ?? "") };
  });
  return { staff: roster, headerDates, rows };
}

/** Column tolerance = half the smallest gap between adjacent anchors (fallback 30) — so a cell is matched to
 *  its own column but a stray glyph outside every column isn't force-assigned. */
function columnTol(anchors: number[]): number {
  let minGap = Infinity;
  for (let i = 1; i < anchors.length; i++) minGap = Math.min(minGap, anchors[i]! - anchors[i - 1]!);
  return Number.isFinite(minGap) ? minGap / 2 : 30;
}

/**
 * Serialize a StaffDateGrid to CSV text (header `NAME,<iso>,<iso>…`, one row per staff). This lets the
 * staff x date PDF converge on the EXISTING CSV import routes (propose/preview/commit) unchanged — the PDF
 * becomes a CSV internally, so there is one code path for both, not a parallel importer. Cells/names are
 * RFC-4180-quoted only when they contain a comma/quote/newline (shift codes like "6-3 BF" don't).
 */
export function gridToCsv(grid: StaffDateGrid): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["NAME", ...grid.headerDates].map(esc).join(",");
  const rows = grid.rows.map((r) => [r.name, ...r.cells].map(esc).join(","));
  return [header, ...rows].join("\n");
}

/** Read a .pdf buffer -> StaffDateGrid via unpdf's positioned extraction. Throws EmptyExtractionError if no
 *  staff x date schedule grid is found (same failure contract as the VA path). */
export async function extractStaffDateGridFromPdf(buffer: Uint8Array): Promise<StaffDateGrid> {
  const { extractTextItems } = await import("unpdf");
  const result = (await extractTextItems(buffer)) as { items?: PdfTextItem[][] | PdfTextItem[] };
  const raw = result.items ?? [];
  const pages: PdfTextItem[][] = Array.isArray(raw[0]) ? (raw as PdfTextItem[][]) : [raw as PdfTextItem[]];
  const grid = pdfItemsToStaffDateGrid(pages);
  if (grid.staff.length === 0 || grid.headerDates.length === 0) {
    const { EmptyExtractionError } = await import("@/lib/documents/extractText");
    throw new EmptyExtractionError("No staff-by-date schedule grid was found in the .pdf.");
  }
  return grid;
}
