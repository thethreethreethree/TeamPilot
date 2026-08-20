import type { Shift, Employee } from "./types";
import { toCsv } from "@/lib/export/toCsv";

/**
 * Schedule Management System — DATA export (CSV / Excel / data-PDF), built to ROUND-TRIP back through the
 * import pipeline (the founder's ask: "downloaded in pdf/excel/csv … so it can be imported back"). The shape
 * mirrors exactly what the importer expects: a staff × date grid whose header is ISO dates and whose cells are
 * explicit "HH:mm-HH:mm" ranges (or "" for a non-working day). Because the cells carry explicit times, the
 * importer's `autoTimeRangeCodeMap` maps them deterministically — no code-mapping step, no LLM, on re-import.
 *
 * Pure + unit-tested, including a full round-trip test (grid → CSV → parseCsvToGrid → parseScheduleGrid → the
 * same shifts). The file writers (xlsx zip, PDF) build on `toAoa`.
 */

export interface ExportGrid {
  /** ISO dates (YYYY-MM-DD) across the top, sorted ascending. */
  dates: string[];
  /** One row per staff member; `cells` aligns to `dates` — "HH:mm-HH:mm" or "" (not working that day). */
  rows: { name: string; cells: string[] }[];
}

/**
 * Pivot derived shifts into the export grid. Columns are every distinct date that has a shift (optionally from
 * `fromDate` forward); rows are active staff plus anyone actually scheduled (so a deactivated-but-scheduled
 * person still exports). One cell per person per date — if a person has more than one shift that day, the
 * earliest-starting one wins (stable, matches the one-cell grid the app shows).
 */
export function buildExportGrid(shifts: Shift[], roster: Employee[], opts?: { fromDate?: string; toDate?: string }): ExportGrid {
  const from = opts?.fromDate;
  const to = opts?.toDate;
  const used = shifts.filter((s) => (!from || s.date >= from) && (!to || s.date <= to) && s.assigned.length > 0);
  const dateSet = new Set<string>();
  const byPerson = new Map<string, Map<string, string>>();
  const scheduled = new Set<string>();
  for (const s of used) {
    dateSet.add(s.date);
    const label = `${s.start}-${s.end}`;
    for (const empId of s.assigned) {
      scheduled.add(empId);
      if (!byPerson.has(empId)) byPerson.set(empId, new Map());
      const prev = byPerson.get(empId)!.get(s.date);
      if (prev === undefined || s.start < prev) byPerson.get(empId)!.set(s.date, label);
    }
  }
  const dates = [...dateSet].sort();
  const rows = roster
    .filter((e) => e.status === "active" || scheduled.has(e.id))
    .map((e) => ({ name: e.name, cells: dates.map((d) => byPerson.get(e.id)?.get(d) ?? "") }));
  return { dates, rows };
}

/** Grid → array-of-arrays (header row + one row per staff). The shared shape the CSV and xlsx writers consume. */
export function toAoa(grid: ExportGrid): string[][] {
  return [["Name", ...grid.dates], ...grid.rows.map((r) => [r.name, ...r.cells])];
}

/** Grid → RFC-4180 CSV via the shared, formula-injection-safe writer (CWE-1236 — csvSafe). Re-importable. */
export function gridToCsv(grid: ExportGrid): string {
  const columns = ["Name", ...grid.dates];
  const rows = grid.rows.map((r) => {
    const obj: Record<string, string> = { Name: r.name };
    grid.dates.forEach((d, i) => { obj[d] = r.cells[i] ?? ""; });
    return obj;
  });
  return toCsv(rows, columns);
}
