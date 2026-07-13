import { describe, it, expect } from "vitest";
import { parseCsv, toIso } from "@/lib/finance/bankCsv";

describe("parseCsv (bank statement import)", () => {
  it("keeps commas inside quoted fields — the data-integrity case", () => {
    // "ACME, INC" must NOT split the description into two columns and shift the amount.
    const csv = 'Date,Description,Amount\n2026-07-01,"ACME, INC — invoice, paid",1500.00';
    const rows = parseCsv(csv);
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
    const rows = parseCsv(csv);
    expect(rows[0]!.amount).toBe(1234.56);
  });

  it("handles negative amounts (withdrawals) and escaped quotes", () => {
    const csv = 'Date,Amount,Description\n2026-07-03,-42.00,"say ""hi"" to payee"';
    const rows = parseCsv(csv);
    expect(rows[0]!.amount).toBe(-42);
    expect(rows[0]!.description).toBe('say "hi" to payee');
  });

  it("maps columns by header name variants and coerces MM/DD/YYYY dates", () => {
    const csv = "Transaction Date,Value,Narrative,Reference\n07/04/2026,99.99,Coffee,REF-1";
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual({
      txnDate: "2026-07-04",
      amount: 99.99,
      description: "Coffee",
      externalId: "REF-1",
    });
  });

  it("skips rows with an unparseable date or non-finite amount", () => {
    const csv = "Date,Amount\n2026-07-05,100\nnot-a-date,50\n2026-07-06,abc\n2026-07-07,200";
    const rows = parseCsv(csv);
    expect(rows.map((r) => r.amount)).toEqual([100, 200]);
  });

  it("returns [] for empty or header-only input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("Date,Amount")).toEqual([]); // header only, no data rows
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
