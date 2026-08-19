/**
 * Schedule Management System — CSV → grid extraction (Phase 5, S3; the tractable file format, no new dep).
 *
 * Turns raw CSV text into the { headerCells, rows } structure the gridParser consumes. This is the
 * format-specific extraction step for CSV (Excel/PDF have their own extractors — xlsx needs a lib, PDF
 * reuses documents/extractText). Deterministic + testable. RESOLVING the header labels to ISO dates
 * ("AUG 16" → "2026-08-16") is a separate, fuzzy step (LLM-assisted + human-confirmed), NOT done here.
 *
 * The CSV line splitter is RFC-4180 minimal (honors double-quoted fields with embedded commas) — the same
 * shape as finance/bankCsv's inline splitter (that one is coupled to the bank-statement parser, so this is a
 * small deliberate re-statement for a decoupled module rather than a refactor of a tested finance path).
 */

export interface CsvGrid {
  /** The header row's cells AFTER the first (name) column — the date/day labels. */
  headerCells: string[];
  rows: { name: string; cells: string[] }[];
}

/** Split one CSV line into fields, honoring "quoted, fields" with embedded commas and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/**
 * Parse CSV text into a grid. The header row is `headerRowIndex` (default: the first non-empty line);
 * column 0 of every subsequent line is the staff name, the rest are the day cells. Empty lines are
 * skipped. A blank name (a section-separator row like "PM SHIFT,,,") is kept as a row with an empty name
 * so the gridParser can drop it — extraction does not decide what's a person (single responsibility).
 */
export function parseCsvToGrid(text: string, opts?: { headerRowIndex?: number }): CsvGrid {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headerCells: [], rows: [] };
  const headerIdx = Math.min(opts?.headerRowIndex ?? 0, lines.length - 1);
  const header = splitCsvLine(lines[headerIdx] ?? "");
  const headerCells = header.slice(1);
  const rows: { name: string; cells: string[] }[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i] ?? "");
    rows.push({ name: (cols[0] ?? "").trim(), cells: cols.slice(1) });
  }
  return { headerCells, rows };
}
