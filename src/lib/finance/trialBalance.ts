/**
 * Trial-balance parsing for the opening-balance import (0169).
 *
 * This lives in a tested module rather than inline in the page because CSV parsing is where this codebase
 * has already been bitten twice — a BOM silently corrupting the first field, and rows being dropped without
 * anyone being told. Both are re-tested below rather than merely re-avoided.
 *
 * THE PARSER'S CENTRAL RULE: it never drops a row silently, and it never repairs one. An unreadable row is
 * RETURNED as unreadable. A trial balance missing an account still balances-or-doesn't in a way that looks
 * entirely plausible, so a silent skip produces an import that appears complete and is not — and the
 * resulting discrepancy gets blamed on the company's old system rather than on us.
 */

export type TbAccount = { id: string; code: string };
export type TbLine = { code: string; debit: number; credit: number; accountId: string };
export type TbResult = { lines: TbLine[]; bad: string[] };

export function parseTrialBalance(text: string, accounts: TbAccount[]): TbResult {
  const byCode = new Map(accounts.map((a) => [a.code.trim(), a.id]));
  const lines: TbLine[] = [];
  const bad: string[] = [];

  // Strip the UTF-8 BOM. Excel writes it, and it silently corrupts the first account code — which then
  // fails to match, and the account vanishes from the import.
  const rows = text.replace(/^﻿/, "").split(/\r?\n/);

  for (const raw of rows) {
    const row = raw.trim();
    if (!row) continue;

    const cells = splitRow(row);
    const code = (cells[0] ?? "").replace(/^["']|["']$/g, "");

    // A header row is not an error, but only skip one that is unmistakably a header. Guessing more broadly
    // would silently discard a real account.
    if (/^(code|account|account\s*code)$/i.test(code)) continue;

    if (cells.length < 2) {
      bad.push(row);
      continue;
    }

    const debit = num(cells[1]);
    const credit = num(cells[2]);
    const accountId = byCode.get(code);

    // Unknown account code → reported, never invented. Adding an account on the user's behalf during an
    // import would put a fabricated line in their chart of accounts.
    if (!accountId || debit === null || credit === null) {
      bad.push(row);
      continue;
    }
    // Debit XOR credit — the ledger's own rule (0118). An import is not the place to relax it.
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      bad.push(row);
      continue;
    }
    lines.push({ code, debit, credit, accountId });
  }

  return { lines, bad };
}

/**
 * Split a row into cells, RESPECTING QUOTES.
 *
 * A naive `.split(",")` is not merely sloppy here, it is dangerous — and the test suite caught it doing
 * exactly this: a quoted amount like `"$10,000.00"` contains the delimiter inside itself, so a naive split
 * cuts it into `"$10` and `000.00"`. The first parses cleanly as 10, the line is accepted as VALID, and a
 * ten-thousand-dollar cash balance silently enters the books as ten dollars. The resulting imbalance would
 * then be attributed to the company's old system rather than to us.
 *
 * The failure is invisible precisely because the row still parses. So the delimiter is only a delimiter
 * when it is outside quotes.
 */
function splitRow(row: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quote: string | null = null;

  for (const ch of row) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "," || ch === "\t" || ch === ";") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** Returns null (not 0) for anything unparseable. A bad figure read as 0 is a wrong balance, silently. */
function num(cell: string | undefined): number | null {
  if (cell === undefined || cell.trim() === "") return 0;
  const cleaned = cell.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Debits minus credits. Non-zero means the SOURCE trial balance did not balance — which is a fact to
 *  surface, never a defect to correct. */
export function tbImbalance(lines: TbLine[]): number {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  return Math.round((d - c) * 10000) / 10000;
}
