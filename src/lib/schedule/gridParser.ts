/**
 * Schedule Management System — the file-upload grid parser (Phase 5, DETERMINISTIC core; feature S3).
 *
 * Real schedules (the founder's HK / HUB SCHED / frendz samples) are a staff x date grid of shift codes
 * ("6-3", "2-11", "OFF", "GY", "1--10", "6-3 BF"). This turns a NORMALIZED grid (already extracted from the
 * PDF/Excel/CSV — that format-specific extraction is a separate step) into structured entries, given a
 * shift-code MAP. The map is a PARAMETER, never guessed here: what "GY" or "6-3 BF" mean is org-specific, so
 * the LLM proposes the map and the human CONFIRMS it (the founder's parse-then-confirm pick), then this pure
 * function applies it. Unknown codes are flagged, never silently dropped or invented (§3.4 honesty).
 */

export interface ShiftTimes {
  start: string; // "HH:mm"
  end: string;
}

/** A shift-code → meaning map. A code maps to shift times, to "off", or is absent (→ unknown/flagged). */
export type ShiftCodeMap = Record<string, ShiftTimes | "off">;

/**
 * Upper bound on staff rows a single grid import accepts. parseScheduleGrid emits one entry per row PER header
 * date (rows × headerDates), and headerDates is capped at 400 — so without a row bound a 1MB CSV of ~500k trivial
 * rows explodes to ~200M entry objects → serverless OOM/500 (an availability defect, manager-reachable by a large
 * paste). A real roster is well under this; the routes reject a larger grid with a graceful 413, never a silent
 * truncation (§3.4) nor an opaque crash. Bounds the entry count with the date cap: 1000 × 400 stays serializable.
 */
export const MAX_GRID_ROWS = 1000;

export interface GridEntry {
  employeeName: string;
  date: string; // ISO YYYY-MM-DD
  rawCode: string;
  kind: "shift" | "off" | "empty" | "unknown";
  times?: ShiftTimes; // present when kind === "shift"
}

export interface ParsedGrid {
  staff: string[];
  entries: GridEntry[];
  /** Distinct codes that were not in the map — surfaced so the human can extend the map (never guessed). */
  unknownCodes: string[];
}

/** Normalize a cell/code for lookup: trim, collapse internal whitespace, upper-case, collapse repeated
 *  dashes ("1--10" → "1-10"). Kept deliberately light so the map keys are predictable. */
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").replace(/-{2,}/g, "-").toUpperCase();
}

/**
 * Parse a normalized staff x date grid into structured entries. `headerDates` are the ISO dates for each
 * column (already resolved from the file's header — a separate step). Each row is a staff member + their
 * cells aligned to those columns. Pure + deterministic.
 */
export function parseScheduleGrid(args: {
  headerDates: string[];
  rows: { name: string; cells: string[] }[];
  codeMap: ShiftCodeMap;
}): ParsedGrid {
  const { headerDates, rows, codeMap } = args;
  // Normalize the map keys once so lookups are case/dash-insensitive.
  const normMap: ShiftCodeMap = {};
  for (const [k, v] of Object.entries(codeMap)) normMap[normalizeCode(k)] = v;

  const staff: string[] = [];
  const entries: GridEntry[] = [];
  const unknown = new Set<string>();

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue; // a blank name is a section separator (e.g. "PM SHIFT"), not a person
    staff.push(name);
    for (let i = 0; i < headerDates.length; i++) {
      const date = headerDates[i];
      const raw = (row.cells[i] ?? "").trim();
      if (!date) continue;
      if (raw === "") {
        entries.push({ employeeName: name, date, rawCode: "", kind: "empty" });
        continue;
      }
      const norm = normalizeCode(raw);
      const mapped = normMap[norm];
      if (mapped === "off") {
        entries.push({ employeeName: name, date, rawCode: raw, kind: "off" });
      } else if (mapped && typeof mapped === "object") {
        entries.push({ employeeName: name, date, rawCode: raw, kind: "shift", times: mapped });
      } else {
        unknown.add(norm);
        entries.push({ employeeName: name, date, rawCode: raw, kind: "unknown" });
      }
    }
  }

  return { staff, entries, unknownCodes: [...unknown].sort() };
}
