// Pure, testable finance-statement helpers (no React, no DB) — so the CSV export + tie-out logic
// have real headless unit coverage (the SQL acceptance tests need a live DB; these don't).

export type StmtLine = { code: string; name: string; amount: number };
export type TbRow = {
  account_id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
};
export type Statements = {
  trial_balance: { rows: TbRow[]; total_debit: number; total_credit: number };
  income_statement: {
    revenue: StmtLine[];
    expenses: StmtLine[];
    total_revenue: number;
    total_expenses: number;
    net_income: number;
  };
  balance_sheet: {
    assets: StmtLine[];
    liabilities: StmtLine[];
    equity: StmtLine[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    net_income: number;
  };
};

const n2 = (n: number) => (Number(n) || 0).toFixed(2);

/** True iff Assets = Liabilities + Equity + current-period Net Income (to the cent). */
export function balanceSheetTiesOut(bs: Statements["balance_sheet"]): boolean {
  const rhs = Number(bs.total_liabilities) + Number(bs.total_equity) + Number(bs.net_income);
  return Math.abs(Number(bs.total_assets) - rhs) < 0.005;
}

/** True iff Trial Balance total debits = total credits (to the cent). */
export function trialBalances(tb: Statements["trial_balance"]): boolean {
  return Math.abs(Number(tb.total_debit) - Number(tb.total_credit)) < 0.005;
}

/**
 * Neutralize spreadsheet formula injection (CWE-1236). Account names/codes are user-controlled,
 * and this CSV is opened in Excel/Sheets, which evaluates any cell beginning with = + - @ TAB CR
 * as a formula — even when the value is CSV-quoted (the quotes are stripped as delimiters first).
 * A cell that is a well-formed number (incl. a legitimate negative amount like -123.45) is left
 * intact; anything else with a formula-leading char is prefixed with an apostrophe so the
 * spreadsheet treats it as literal text.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const isNumericCell = (v: string) => /^-?\d+(\.\d+)?$/.test(v);
const deFormula = (v: string) => (FORMULA_LEAD.test(v) && !isNumericCell(v) ? "'" + v : v);

/** Build one CSV of all three statements. Values are already SQL-derived — we only format. */
export function statementsToCsv(s: Statements): string {
  const rows: string[] = [];
  const q = (v: string | number) => `"${deFormula(String(v)).replace(/"/g, '""')}"`;
  const row = (...cells: (string | number)[]) => rows.push(cells.map(q).join(","));

  rows.push("INCOME STATEMENT");
  rows.push("Section,Code,Account,Amount");
  s.income_statement.revenue.forEach((l) => row("Revenue", l.code, l.name, n2(l.amount)));
  row("", "", "Total revenue", n2(s.income_statement.total_revenue));
  s.income_statement.expenses.forEach((l) => row("Expense", l.code, l.name, n2(l.amount)));
  row("", "", "Total expenses", n2(s.income_statement.total_expenses));
  row("", "", "Net income", n2(s.income_statement.net_income));
  rows.push("");
  rows.push("BALANCE SHEET");
  rows.push("Section,Code,Account,Amount");
  s.balance_sheet.assets.forEach((l) => row("Asset", l.code, l.name, n2(l.amount)));
  row("", "", "Total assets", n2(s.balance_sheet.total_assets));
  s.balance_sheet.liabilities.forEach((l) => row("Liability", l.code, l.name, n2(l.amount)));
  s.balance_sheet.equity.forEach((l) => row("Equity", l.code, l.name, n2(l.amount)));
  row("", "", "Net income (current period)", n2(s.balance_sheet.net_income));
  rows.push("");
  rows.push("TRIAL BALANCE");
  rows.push("Code,Account,Type,Debit,Credit");
  s.trial_balance.rows.forEach((r) => row(r.code, r.name, r.type, n2(r.debit), n2(r.credit)));
  row("", "Totals", "", n2(s.trial_balance.total_debit), n2(s.trial_balance.total_credit));
  return rows.join("\r\n");
}
