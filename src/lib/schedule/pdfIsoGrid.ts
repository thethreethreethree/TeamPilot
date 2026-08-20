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

/**
 * GENERIC fallback: turn ANY positioned staff×date PDF into CSV text by clustering items into COLUMNS (by x) and
 * ROWS (by y). A grid the frendz/ISO readers don't recognize — e.g. one with "AUG 16" date-label headers and
 * codes like "6-3"/"OFF" — still becomes the CSV that the normal propose/Analyze flow (LLM date-resolution +
 * human confirm) handles, the SAME path .docx/.xlsx already use. Multi-token cells (a header split by the PDF
 * into "AUG" + "16") are merged within their column. Returns "" when there's nothing to read.
 */
export function pdfGridToCsv(pages: PdfTextItem[][]): string {
  // Clean per page (keep the page boundary — PDF y RESETS per page, so rows must be grouped WITHIN a page or
  // rows at the same y on different pages collide/merge). Columns are clustered GLOBALLY (the layout's x is
  // consistent across pages), rows are grouped PER PAGE and emitted in page order.
  const cleanPages = pages.map((p) =>
    p.map((i) => ({ str: i.str.replace(/\s+/g, " ").trim(), x: i.x, y: i.y })).filter((i) => i.str.length > 0),
  );
  const all = cleanPages.flat();
  if (all.length === 0) return "";

  // Column centroids: walk x ascending, start a new column when the gap from the running centroid exceeds tol.
  const TOL = 24;
  const clusters: { sum: number; n: number; center: number }[] = [];
  for (const it of [...all].sort((a, b) => a.x - b.x)) {
    const last = clusters[clusters.length - 1];
    if (last && it.x - last.center <= TOL) { last.sum += it.x; last.n += 1; last.center = last.sum / last.n; }
    else clusters.push({ sum: it.x, n: 1, center: it.x });
  }
  const centers = clusters.map((c) => c.center);
  const nearestCol = (x: number) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < centers.length; i++) { const d = Math.abs(centers[i]! - x); if (d < bd) { bd = d; bi = i; } }
    return bi;
  };

  // Build the grid as rows of cells (per page, in order); post-process for real-world layouts below.
  const grid: string[][] = [];
  for (const pageItems of cleanPages) {
    // Rows by y (top-to-bottom), WITHIN this page only.
    const rows: { y: number; items: { str: string; x: number }[] }[] = [];
    for (const it of [...pageItems].sort((a, b) => b.y - a.y)) {
      const r = rows.find((rr) => Math.abs(rr.y - it.y) <= 4);
      if (r) r.items.push({ str: it.str, x: it.x });
      else rows.push({ y: it.y, items: [{ str: it.str, x: it.x }] });
    }
    for (const r of rows) {
      const cells: string[] = new Array(centers.length).fill("");
      for (const it of r.items.sort((a, b) => a.x - b.x)) {
        const ci = nearestCol(it.x);
        cells[ci] = cells[ci] ? `${cells[ci]} ${it.str}` : it.str;
      }
      let last = cells.length - 1;
      while (last >= 0 && !cells[last]!.trim()) last--;
      if (last < 0) continue; // fully-empty row
      grid.push(cells.slice(0, last + 1));
    }
  }

  // Merge NAMELESS rows (blank first cell) into the row above. Real schedules (HUB SCHED.pdf) split a two-row
  // header — a month row ("AUG." per column) and a day-number row ("16", "17", …) — and wrap a long cell
  // ("SKY-" + "BAR") onto the next visual line; both arrive as a row whose NAME column is blank. Appending their
  // cells to the previous row reunites "AUG."+"16" → "AUG. 16" (a resolvable date) and the wrapped code, and
  // folds the day-number row into the header. A nameless row with no data at all is dropped.
  const mergedRows: string[][] = [];
  for (const row of grid) {
    const nameBlank = !(row[0] ?? "").trim();
    const hasData = row.some((c) => (c ?? "").trim());
    if (nameBlank && mergedRows.length > 0 && hasData) {
      const prev = mergedRows[mergedRows.length - 1]!;
      for (let i = 0; i < row.length; i++) {
        const v = (row[i] ?? "").trim();
        if (!v) continue;
        while (prev.length <= i) prev.push("");
        prev[i] = prev[i]!.trim() ? `${prev[i]!.trim()} ${v}` : v;
      }
      continue;
    }
    if (nameBlank && !hasData) continue; // fully empty
    mergedRows.push([...row]);
  }

  // Drop section-label rows: a NAMED row with no data cells at all (e.g. "PM SHIFT", "SKY BAR") is a divider, not
  // a person — it carries nothing importable. The header (row 0) is always kept.
  const cleaned = mergedRows.filter((row, i) => i === 0 || row.slice(1).some((c) => (c ?? "").trim()));

  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = cleaned.map((row) => row.map(esc).join(","));
  // Drop header rows repeated by pagination: page 2+ of a multi-page grid repeats the "Name, date, date…" header
  // row. Left in, each repeat re-parses into a bogus staff member named after the first header cell ("NAME").
  // Keep the first occurrence (the real header); drop later exact-duplicate header lines only.
  const header = lines[0];
  const deduped = header ? lines.filter((l, i) => i === 0 || l !== header) : lines;
  return deduped.join("\n");
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
