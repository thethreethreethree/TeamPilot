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

// Accept MM/DD/YYYY or DD/MM/YYYY-ish → ISO (best-effort; ambiguous locales fall back to as-typed).
export function toIso(s: string): string {
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return "";
  const [, a, b, y] = m;
  const mm = String(a).padStart(2, "0");
  const dd = String(b).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
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
  const iDesc = header.findIndex((h) => h.includes("desc") || h.includes("memo") || h.includes("payee") || h.includes("narrative"));
  const iId = header.findIndex((h) => h === "id" || h.includes("reference") || h.includes("ref") || h.includes("transaction id"));
  const rows: BankCsvRow[] = [];
  let skipped = 0;
  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]!);
    const rawDate = (cols[iDate] ?? "").slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toIso(rawDate);
    const amount = Number((cols[iAmt] ?? "").replace(/[$,]/g, ""));
    // A data line we can't read (unparseable date, or a non-numeric amount like a parenthesized
    // "(50.00)") is COUNTED, not silently dropped — the caller surfaces the count so a partial import
    // is visible on a financial file, not mistaken for complete.
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
