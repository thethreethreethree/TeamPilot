import { describe, it, expect } from "vitest";
import { parseCsv, toIso, parseAmount } from "@/lib/finance/bankCsv";

describe("parseCsv (bank statement import)", () => {
  it("keeps commas inside quoted fields — the data-integrity case", () => {
    // "ACME, INC" must NOT split the description into two columns and shift the amount.
    const csv = 'Date,Description,Amount\n2026-07-01,"ACME, INC — invoice, paid",1500.00';
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      txnDate: "2026-07-01",
      amount: 1500,
      description: "ACME, INC — invoice, paid",
      externalId: undefined,
    });
  });

  it("strips currency symbols + thousands separators from the amount", () => {
    const csv = 'Date,Amount,Memo\n2026-07-02,"$1,234.56",fee';
    expect(parseCsv(csv).rows[0]!.amount).toBe(1234.56);
  });

  it("handles negative amounts (withdrawals) and escaped quotes", () => {
    const csv = 'Date,Amount,Description\n2026-07-03,-42.00,"say ""hi"" to payee"';
    const { rows } = parseCsv(csv);
    expect(rows[0]!.amount).toBe(-42);
    expect(rows[0]!.description).toBe('say "hi" to payee');
  });

  it("parses parenthesized + trailing-minus withdrawals (accounting/Excel/QuickBooks exports)", () => {
    // Before parseAmount, "(100.00)" failed Number() and got SKIPPED — so a file whose withdrawals
    // are all parenthesized imported only its deposits and could never reconcile. These now parse.
    const csv =
      'Date,Amount\n2026-07-03,"(100.00)"\n2026-07-04,"($1,234.56)"\n2026-07-05,250.00-\n2026-07-06,75.00';
    const { rows, skipped } = parseCsv(csv);
    expect(rows.map((r) => r.amount)).toEqual([-100, -1234.56, -250, 75]);
    expect(skipped).toBe(0); // none skipped — all four are legitimate signed amounts
  });

  it("parseAmount: genuine garbage still returns NaN (so the caller skips+counts it, no false zero)", () => {
    // The negative notations must not swallow unreadable cells into a misleading 0 or wrong sign.
    expect(Number.isFinite(parseAmount("abc"))).toBe(false);
    expect(Number.isFinite(parseAmount("(abc)"))).toBe(false);
    expect(Number.isFinite(parseAmount(""))).toBe(false);
    // and the ordinary cases stay intact:
    expect(parseAmount("$1,234.56")).toBe(1234.56);
    expect(parseAmount("-42.00")).toBe(-42);
  });

  it("maps columns by header name variants and coerces MM/DD/YYYY dates", () => {
    const csv = "Transaction Date,Value,Narrative,Reference\n07/04/2026,99.99,Coffee,REF-1";
    expect(parseCsv(csv).rows[0]).toEqual({
      txnDate: "2026-07-04",
      amount: 99.99,
      description: "Coffee",
      externalId: "REF-1",
    });
  });

  it("disambiguates DD/MM vs MM/DD by the >12 signal (European withdrawals no longer become invalid dates)", () => {
    // The old parser took the first field as the month always, so a day-first "25/12/2026" became
    // "2026-25-12" (month 25) — an invalid date that got imported then rejected by the DB. Now: a
    // field >12 must be the day. Both <=12 stays MM/DD (documented default); both >12 is unreadable.
    expect(toIso("25/12/2026")).toBe("2026-12-25"); // day-first (unambiguous) → Dec 25
    expect(toIso("13/07/2026")).toBe("2026-07-13"); // day-first → Jul 13
    expect(toIso("07/13/2026")).toBe("2026-07-13"); // month-first (unambiguous) → Jul 13
    expect(toIso("07/04/2026")).toBe("2026-07-04"); // ambiguous → MM/DD default (unchanged)
    expect(toIso("13/25/2026")).toBe(""); // both >12 → not a real date → skipped
    expect(toIso("00/05/2026")).toBe(""); // month 0 → out of range → skipped, not imported
  });

  it("a day-first invalid date is SKIPPED, not imported as a broken date", () => {
    // End-to-end: the row with the European-format date must not enter with a month-25 string.
    const csv = "Date,Amount\n25/12/2026,-40.00\n2026-07-06,200";
    const { rows, skipped } = parseCsv(csv);
    expect(rows.map((r) => r.txnDate)).toEqual(["2026-12-25", "2026-07-06"]);
    expect(skipped).toBe(0);
  });

  it("handles SEPARATE Debit/Credit columns (a very common format that used to import NOTHING)", () => {
    // No single "amount" column → the old parser found iAmt=-1 and skipped every row (total failure).
    // Now: signed = credit(in) − debit(out); blank column = 0.
    const csv =
      "Date,Description,Debit,Credit\n2026-07-01,Payroll,,2500.00\n2026-07-02,Rent,1800.00,\n2026-07-03,Refund,,50.00";
    const { rows, skipped } = parseCsv(csv);
    expect(rows.map((r) => r.amount)).toEqual([2500, -1800, 50]);
    expect(skipped).toBe(0);
  });

  it("handles Withdrawal/Deposit column naming + 'Debit Amount'/'Credit Amount' (both contain 'amount')", () => {
    // "Debit Amount"/"Credit Amount" both match includes("amount"); two-column mode must still win so
    // the debit-amount column isn't mistaken for the signed total.
    const csv1 = "Date,Withdrawal,Deposit\n2026-07-01,100.00,\n2026-07-02,,300.00";
    expect(parseCsv(csv1).rows.map((r) => r.amount)).toEqual([-100, 300]);
    const csv2 = 'Date,"Debit Amount","Credit Amount"\n2026-07-01,"1,200.00",\n2026-07-02,,"3,400.00"';
    expect(parseCsv(csv2).rows.map((r) => r.amount)).toEqual([-1200, 3400]);
  });

  it("two-column: a row with BOTH debit+credit blank is skipped+counted (not a phantom 0)", () => {
    const csv = "Date,Debit,Credit\n2026-07-01,,\n2026-07-02,,75.00";
    const { rows, skipped } = parseCsv(csv);
    expect(rows.map((r) => r.amount)).toEqual([75]);
    expect(skipped).toBe(1);
  });

  it("skips unreadable rows AND reports the skipped count (no silent data loss)", () => {
    const csv = "Date,Amount\n2026-07-05,100\nnot-a-date,50\n2026-07-06,abc\n2026-07-07,200";
    const { rows, skipped } = parseCsv(csv);
    expect(rows.map((r) => r.amount)).toEqual([100, 200]);
    expect(skipped).toBe(2); // the bad-date row + the non-numeric-amount row — surfaced, not dropped silently
  });

  it("strips a leading UTF-8 BOM (Excel export) so a first-column exact-match header still maps", () => {
    // U+FEFF is the BOM Excel prepends. With "ID" as the first column, an un-stripped BOM makes
    // header[0] = "<BOM>id", which fails the exact `h === "id"` check → externalId silently dropped.
    // Build the BOM via fromCharCode so no invisible character lives in the source.
    const csv = String.fromCharCode(0xfeff) + "ID,Date,Amount\nTX-9,2026-07-08,10.00";
    expect(parseCsv(csv).rows[0]).toEqual({ txnDate: "2026-07-08", amount: 10, description: undefined, externalId: "TX-9" });
  });

  it("returns empty rows + 0 skipped for empty or header-only input", () => {
    expect(parseCsv("")).toEqual({ rows: [], skipped: 0 });
    expect(parseCsv("Date,Amount")).toEqual({ rows: [], skipped: 0 }); // header only, no data rows
  });
});

describe("toIso", () => {
  it("converts MM/DD/YYYY (or -) to ISO, else empty string", () => {
    expect(toIso("07/04/2026")).toBe("2026-07-04");
    expect(toIso("7-4-2026")).toBe("2026-07-04");
    expect(toIso("2026-07-04")).toBe(""); // already ISO — not this fn's job (caller passes ISO through)
    expect(toIso("garbage")).toBe("");
  });
});
