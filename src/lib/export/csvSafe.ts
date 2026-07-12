/**
 * Single authoritative defense against spreadsheet formula injection (CWE-1236 / OWASP
 * "CSV Injection") for every CSV this app produces.
 *
 * WHY THIS EXISTS SEPARATELY: RFC-4180 quoting (wrapping a field in quotes, doubling inner
 * quotes) makes a CSV *parse* correctly — but it does NOT make it *safe to open*. Excel, Google
 * Sheets, and LibreOffice strip the CSV quotes as delimiters first, then evaluate any resulting
 * cell whose first character is one of  =  +  -  @  TAB  CR  as a formula. Since our exports carry
 * user-authored free text (task titles, diagnoses, account names), a value like
 * =HYPERLINK("http://evil","click")  runs when a teammate opens the download. Quoting alone can't
 * stop it; a leading-character guard can.
 *
 * Two CSV producers now depend on this (src/lib/export/toCsv.ts and src/lib/finance/statements.ts).
 * A security primitive duplicated in two places drifts; keeping ONE copy is the point.
 */

const FORMULA_LEAD = /^[=+\-@\t\r]/;
// A legitimate number — including a real negative amount like -123.45 — must survive untouched so a
// numeric column stays numeric in the spreadsheet. Only non-numeric formula-leading text is escaped.
const WELL_FORMED_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * If `value` would be interpreted as a formula by a spreadsheet and is not a plain number, prefix
 * a single apostrophe so the spreadsheet treats it as literal text. Otherwise return it unchanged.
 */
export function neutralizeCsvFormula(value: string): string {
  if (FORMULA_LEAD.test(value) && !WELL_FORMED_NUMBER.test(value)) {
    return "'" + value;
  }
  return value;
}
