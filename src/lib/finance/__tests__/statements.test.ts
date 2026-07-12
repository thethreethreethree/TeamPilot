import { describe, it, expect } from "vitest";
import {
  statementsToCsv,
  balanceSheetTiesOut,
  trialBalances,
  type Statements,
} from "@/lib/finance/statements";

// A minimal balanced example: Revenue 250, Expenses 100 → Net income 150; AR/Cash/AP so the
// balance sheet ties out and the trial balance balances.
const s: Statements = {
  income_statement: {
    revenue: [{ code: "4000", name: "Revenue", amount: 250 }],
    expenses: [{ code: "6000", name: "Operating Expenses", amount: 100 }],
    total_revenue: 250,
    total_expenses: 100,
    net_income: 150,
  },
  balance_sheet: {
    assets: [{ code: "1000", name: "Cash", amount: 150 }],
    liabilities: [],
    equity: [],
    total_assets: 150,
    total_liabilities: 0,
    total_equity: 0,
    net_income: 150,
  },
  trial_balance: {
    rows: [
      { account_id: "a", code: "1000", name: "Cash", type: "asset", debit: 150, credit: 0 },
      { account_id: "b", code: "4000", name: "Revenue", type: "revenue", debit: 0, credit: 250 },
      { account_id: "c", code: "6000", name: "Operating Expenses", type: "expense", debit: 100, credit: 0 },
    ],
    total_debit: 250,
    total_credit: 250,
  },
};

describe("finance statements — integrity checks", () => {
  it("balance sheet ties out: Assets = Liabilities + Equity + Net income", () => {
    expect(balanceSheetTiesOut(s.balance_sheet)).toBe(true);
  });

  it("flags an out-of-balance sheet", () => {
    expect(balanceSheetTiesOut({ ...s.balance_sheet, total_assets: 999 })).toBe(false);
  });

  it("trial balance balances when debits = credits", () => {
    expect(trialBalances(s.trial_balance)).toBe(true);
    expect(trialBalances({ ...s.trial_balance, total_credit: 251 })).toBe(false);
  });

  it("tie-out tolerance is sub-cent (rounding-safe, not float-loose)", () => {
    expect(balanceSheetTiesOut({ ...s.balance_sheet, total_assets: 150.004 })).toBe(true);
    expect(balanceSheetTiesOut({ ...s.balance_sheet, total_assets: 150.02 })).toBe(false);
  });
});

describe("finance statements — CSV export", () => {
  const csv = statementsToCsv(s);
  it("has all three statement sections", () => {
    expect(csv).toContain("INCOME STATEMENT");
    expect(csv).toContain("BALANCE SHEET");
    expect(csv).toContain("TRIAL BALANCE");
  });
  it("formats money to 2 decimals and includes net income", () => {
    expect(csv).toContain('"Net income","150.00"');
    expect(csv).toContain('"4000","Revenue","250.00"');
  });
  it("quotes fields and escapes embedded quotes", () => {
    const s2 = {
      ...s,
      income_statement: {
        ...s.income_statement,
        revenue: [{ code: "4000", name: 'Rev "special"', amount: 10 }],
      },
    };
    expect(statementsToCsv(s2)).toContain('"Rev ""special"""');
  });
  it("uses CRLF line endings (Excel-friendly)", () => {
    expect(csv.includes("\r\n")).toBe(true);
  });
});

describe("finance statements — CSV formula-injection defense (CWE-1236)", () => {
  // A user-controlled account name crafted to run as an Excel/Sheets formula on export+open.
  const withName = (name: string): Statements => ({
    ...s,
    trial_balance: {
      ...s.trial_balance,
      rows: [{ account_id: "x", code: "1000", name, type: "asset", debit: 1, credit: 0 }],
    },
  });

  it("neutralizes an =formula account name (prefixes an apostrophe)", () => {
    const csv = statementsToCsv(withName('=HYPERLINK("http://evil","click")'));
    // The dangerous cell must NOT begin with = after the CSV quote — it must be '=...
    expect(csv).toContain('"\'=HYPERLINK');
    expect(csv).not.toContain('"=HYPERLINK');
  });

  it("neutralizes +, @, and -formula leading chars in text cells", () => {
    expect(statementsToCsv(withName("+1+1"))).toContain("\"'+1+1\"");
    expect(statementsToCsv(withName("@SUM(A1)"))).toContain("\"'@SUM(A1)\"");
    expect(statementsToCsv(withName("-2+3"))).toContain("\"'-2+3\"");
  });

  it("also neutralizes a formula-leading account CODE", () => {
    const csv = statementsToCsv({
      ...s,
      trial_balance: {
        ...s.trial_balance,
        rows: [{ account_id: "x", code: "=1+1", name: "Cash", type: "asset", debit: 1, credit: 0 }],
      },
    });
    expect(csv).toContain('"\'=1+1"');
  });

  it("leaves legitimate negative amounts intact (not misread as formulas)", () => {
    // A real credit/contra balance renders as -50.00 and must stay a number, not become '-50.00.
    const csv = statementsToCsv({
      ...s,
      balance_sheet: {
        ...s.balance_sheet,
        equity: [{ code: "3900", name: "Drawings", amount: -50 }],
      },
    });
    expect(csv).toContain('"-50.00"');
    expect(csv).not.toContain("\"'-50.00\"");
  });
});
