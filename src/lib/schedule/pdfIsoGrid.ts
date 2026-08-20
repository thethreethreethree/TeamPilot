import type { PdfTextItem, StaffDateGrid } from "./staffDatePdf";

/**
 * Generic ISO-header PDF grid reader. Our own data-PDF export (buildTablePdf) writes a positioned-text table
 * with an ISO-date header row ("Name  2026-08-17  2026-08-18 …"); this reads it straight back — DETERMINISTIC,
 * no month/day-number inference, no LLM. It complements the frendz-specific `pdfItemsToStaffDateGrid` (which
 * handles day-number + weekday-row layouts): the import IO tries THIS first when the PDF carries ISO-date
 * headers (our export's signature), and falls back to the frendz parser otherwise.
 *
 * Multi-page merge: a wide/tall schedule paginates into column-groups × row-pages, each repeating the Name
 * column + its ISO header, so pages are merged by staff name (name → date → cell), unioning dates. Pure.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

interface VRow { y: number; items: { str: string; x: number }[] }

/** Cluster positioned items into visual rows by y (PDF y grows upward), items left-to-right. */
function groupRows(items: PdfTextItem[], tol = 4): VRow[] {
  const clean = items
    .map((i) => ({ str: i.str.replace(/\s+/g, " ").trim(), x: i.x, y: i.y }))
    .filter((i) => i.str.length > 0)
    .sort((a, b) => b.y - a.y);
  const rows: VRow[] = [];
  for (const it of clean) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (row) row.items.push({ str: it.str, x: it.x });
    else rows.push({ y: it.y, items: [{ str: it.str, x: it.x }] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Is this a header row of our ISO export? It carries ≥1 ISO date AND is disambiguated from a stray dated line
 *  (e.g. a "Generated <date>" footer) by either ≥2 ISO dates OR a leading "Name" label. This matters because a
 *  paginated column-group can legitimately have a SINGLE date (13 dates → a trailing 1-date page); requiring ≥2
 *  would silently drop that page's cells on re-import. Data rows carry no ISO dates, so they never match. */
function isHeaderRow(row: VRow): boolean {
  const isoCount = row.items.filter((it) => ISO.test(it.str)).length;
  if (isoCount === 0) return false;
  const first = row.items[0]?.str.trim().toLowerCase();
  return isoCount >= 2 || first === "name";
}

/** True when the PDF looks like our ISO-header export (a Name/ISO-date header row). */
export function isIsoHeaderGrid(pages: PdfTextItem[][]): boolean {
  for (const page of pages) {
    for (const row of groupRows(page)) {
      if (isHeaderRow(row)) return true;
    }
  }
  return false;
}

/** Read an ISO-header schedule PDF back into a staff × date grid (merging paginated pages by name). */
export function isoGridFromItems(pages: PdfTextItem[][]): StaffDateGrid {
  const roster: string[] = [];
  const seen = new Set<string>();
  const cells = new Map<string, Map<string, string>>(); // name -> iso -> code
  const allDates = new Set<string>();

  for (const page of pages) {
    let anchors: { x: number; iso: string }[] | null = null;
    for (const row of groupRows(page)) {
      if (isHeaderRow(row)) {
        const isoItems = row.items.filter((it) => ISO.test(it.str));
        anchors = isoItems.map((it) => ({ x: it.x, iso: it.str }));
        anchors.forEach((a) => allDates.add(a.iso));
        continue;
      }
      if (!anchors) continue; // title / pre-header rows
      const firstAnchorX = anchors[0]!.x;
      const nameItems = row.items.filter((it) => it.x < firstAnchorX - 2);
      const name = nameItems.map((it) => it.str).join(" ").trim();
      if (!name || ISO.test(name)) continue;
      if (!seen.has(name)) { seen.add(name); roster.push(name); }
      if (!cells.has(name)) cells.set(name, new Map());
      for (const it of row.items) {
        if (it.x < firstAnchorX - 2) continue; // part of the name
        let best = anchors[0]!;
        let bestD = Infinity;
        for (const a of anchors) { const d = Math.abs(a.x - it.x); if (d < bestD) { bestD = d; best = a; } }
        const prev = cells.get(name)!.get(best.iso);
        cells.get(name)!.set(best.iso, prev ? `${prev} ${it.str}`.trim() : it.str);
      }
    }
  }

  const headerDates = [...allDates].sort();
  return {
    staff: roster,
    headerDates,
    rows: roster.map((name) => ({ name, cells: headerDates.map((d) => cells.get(name)?.get(d) ?? "") })),
    warnings: [],
  };
}
