/**
 * Bank-statement CSV parsing for the Banking import (Phase 3). Extracted from the Banking page so it
 * can be unit-tested — this parses FINANCIAL records, so a regression (e.g. someone "simplifying"
 * splitLine to split(",")) would silently corrupt imported amounts/dates. The tests lock the
 * quote-aware behavior, currency stripping, and date coercion. Pure functions, no DOM.
 *
 * Contract: header row maps columns by name (date / amount|value / desc|memo|payee|narrative /
 * id|reference|ref). Amounts strip $ and thousands commas; deposits are +, withdrawals −. Dates accept
 * ISO (YYYY-MM-DD) or MM/DD/YYYY-ish → ISO (best-effort; ambiguous locales fall back to as-typed).
 * Rows with an unparseable date or non-finite amount are skipped. Limitation (documented): a quoted
 * field containing an embedded newline is not supported — bank exports are single-line rows.
 */
export type BankCsvRow = { txnDate: string; amount: number; description?: string; externalId?: string };

// Accept MM/DD/YYYY or DD/MM/YYYY → ISO. Disambiguates US vs European order with the ">12 can't be a
// month" signal: a field over 12 must be the day, so the other is the month. When BOTH fields are <=12
// the order is genuinely ambiguous (e.g. 07/04) → default to MM/DD, the documented assumption. Returns
// "" for anything it can't turn into a REAL date — no match, both fields >12, or an out-of-range
// month/day — so the caller skips+counts it. This is the fix for the old version, which blindly took
// the first field as the month and thus imported "25/12/2026" as "2026-25-12" (month 25 — an invalid
// date that Postgres' date column would reject, failing the whole import).
export function toIso(s: string): string {
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return "";
  const [, aStr, bStr, y] = m;
  const a = Number(aStr);
  const b = Number(bStr);
  let month: number;
  let day: number;
  if (a > 12 && b > 12) return ""; // e.g. 13/25 — not a real date under either order
  if (a > 12) {
    month = b;
    day = a;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    // Both <=12 — genuinely ambiguous; keep the documented MM/DD default.
    month = a;
    day = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse a bank-CSV amount cell to a signed number. Strips a leading currency symbol and thousands
 * commas, then handles the two universal accounting notations for a NEGATIVE that a bare Number()
 * rejects: parentheses — "(100.00)" → -100 — and a trailing minus — "100.00-" → -100. Many US banks,
 * QuickBooks, and Excel accounting exports write withdrawals this way; without this they fail Number()
 * and every withdrawal on such a file is skipped, so only deposits import and the account can never
 * reconcile. Parentheses = negative is an unambiguous convention (not a guess), so parsing it is
 * correct, not lenient. A genuinely unreadable cell ("abc", "(abc)", "") still returns NaN → the
 * caller skips+counts it, preserving the §3.4 "partial import is visible, not silent" contract.
 */
export function parseAmount(raw: string): number {
  let s = (raw ?? "").trim().replace(/[$,]/g, "");
  let negate = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) {
    negate = true;
    s = paren[1]!.trim();
  } else if (s.endsWith("-")) {
    // Trailing-minus notation (e.g. mainframe/European exports): "100.00-".
    negate = true;
    s = s.slice(0, -1).trim();
  }
  // Guard the empty/symbol-only cell: Number("") is 0 in JS, which would import a blank amount as a
  // phantom $0 transaction instead of skipping it. An amount with no digits is unreadable → NaN → the
  // caller skips+counts it (a blank on a financial file is surfaced, not silently turned into $0).
  if (s === "") return NaN;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return negate ? -n : n;
}

export type BankCsvResult = { rows: BankCsvRow[]; skipped: number };

export function parseCsv(text: string): BankCsvResult {
  // Strip a leading UTF-8 BOM (U+FEFF) — Excel prepends it to CSV exports. Left in, it corrupts the
  // first header cell: includes()-matched columns still work, but an exact-match column (id === "id")
  // fails, silently dropping the dedup externalId. charCodeAt avoids embedding an invisible BOM char.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], skipped: 0 };
  const splitLine = (l: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) {
        if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = splitLine(lines[0]!).map((h) => h.toLowerCase());
  const iDate = header.findIndex((h) => h.includes("date"));
  const iAmt = header.findIndex((h) => h.includes("amount") || h.includes("value"));
  // Many banks export SEPARATE Debit/Credit (or Withdrawal/Deposit) columns instead of one signed
  // Amount. Without handling them, such a file finds no amount column (iAmt = -1) and EVERY row is
  // skipped — a silent total-import failure on a very common format. Detect the pair.
  const iDebit = header.findIndex((h) => h.includes("debit") || h.includes("withdrawal"));
  const iCredit = header.findIndex((h) => h.includes("credit") || h.includes("deposit"));
  // Use two-column mode when both a debit AND a credit column exist (even if one also contains
  // "amount", e.g. "Debit Amount"/"Credit Amount"), or when there's no single amount column but at
  // least one of debit/credit is present.
  const twoCol = (iDebit >= 0 && iCredit >= 0) || (iAmt < 0 && (iDebit >= 0 || iCredit >= 0));
  const iDesc = header.findIndex((h) => h.includes("desc") || h.includes("memo") || h.includes("payee") || h.includes("narrative"));
  const iId = header.findIndex((h) => h === "id" || h.includes("reference") || h.includes("ref") || h.includes("transaction id"));
  const rows: BankCsvRow[] = [];
  let skipped = 0;
  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]!);
    const rawDate = (cols[iDate] ?? "").slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toIso(rawDate);
    let amount: number;
    if (twoCol) {
      // Signed amount = money IN (credit/deposit) − money OUT (debit/withdrawal). Magnitudes, so a
      // stray sign in either column can't flip the result. Both blank/unreadable → NaN → row skips.
      const cRaw = iCredit >= 0 ? parseAmount(cols[iCredit] ?? "") : NaN;
      const dRaw = iDebit >= 0 ? parseAmount(cols[iDebit] ?? "") : NaN;
      amount =
        !Number.isFinite(cRaw) && !Number.isFinite(dRaw)
          ? NaN
          : (Number.isFinite(cRaw) ? Math.abs(cRaw) : 0) - (Number.isFinite(dRaw) ? Math.abs(dRaw) : 0);
    } else {
      amount = parseAmount(cols[iAmt] ?? "");
    }
    // A data line we can't read (unparseable date, or a genuinely non-numeric amount like "abc" or
    // "(abc)", or both debit+credit blank) is COUNTED, not silently dropped — the caller surfaces the
    // count so a partial import is visible on a financial file, not mistaken for complete.
    // (Parenthesized/trailing-minus negatives are parsed by parseAmount, so real withdrawals don't
    // land here; separate Debit/Credit columns are handled above.)
    if (!date || !Number.isFinite(amount)) { skipped++; continue; }
    rows.push({
      txnDate: date,
      amount,
      description: iDesc >= 0 ? cols[iDesc] || undefined : undefined,
      externalId: iId >= 0 ? cols[iId] || undefined : undefined,
    });
  }
  return { rows, skipped };
}
