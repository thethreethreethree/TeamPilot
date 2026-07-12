/**
 * Minimal RFC 4180 CSV writer.
 *
 * Handles:
 *  - Quote fields containing comma, quote, newline, or carriage return
 *  - Escape embedded quotes by doubling them
 *  - null/undefined become empty fields
 *  - Objects/arrays become JSON
 *
 * Why we don't pull a dependency for this: the surface area is small, the
 * format is stable, and a one-file implementation is easier to audit than a
 * library + lockfile entry.
 *
 * SECURITY: RFC-4180 quoting is not enough on its own — a cell that survives quoting can still be
 * run as a formula when the file is opened (CWE-1236). Every data cell is passed through
 * neutralizeCsvFormula() before escaping. See src/lib/export/csvSafe.ts.
 */
import { neutralizeCsvFormula } from "@/lib/export/csvSafe";

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns?: string[]
): string {
  if (rows.length === 0) {
    return (columns ?? []).map(escape).join(",") + "\r\n";
  }
  const cols = columns ?? Object.keys(rows[0]!);
  const header = cols.map(escape).join(",");
  const body = rows
    .map((row) => cols.map((c) => escape(neutralizeCsvFormula(format(row[c])))).join(","))
    .join("\r\n");
  return header + "\r\n" + body + "\r\n";
}

function format(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function escape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
