import { describe, it, expect } from "vitest";
import { neutralizeCsvFormula } from "@/lib/export/csvSafe";
import { toCsv } from "@/lib/export/toCsv";

describe("neutralizeCsvFormula — CWE-1236 defense", () => {
  it("prefixes an apostrophe to =, +, @ formula leads", () => {
    expect(neutralizeCsvFormula("=1+1")).toBe("'=1+1");
    expect(neutralizeCsvFormula('=HYPERLINK("http://evil","x")')).toBe(
      '\'=HYPERLINK("http://evil","x")'
    );
    expect(neutralizeCsvFormula("+1+1")).toBe("'+1+1");
    expect(neutralizeCsvFormula("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralizes TAB and CR leads (the sneaky ones)", () => {
    expect(neutralizeCsvFormula("\t=1+1")).toBe("'\t=1+1");
    expect(neutralizeCsvFormula("\r=1+1")).toBe("'\r=1+1");
  });

  it("neutralizes a -formula but preserves a real negative number", () => {
    expect(neutralizeCsvFormula("-2+3")).toBe("'-2+3"); // formula
    expect(neutralizeCsvFormula("-123.45")).toBe("-123.45"); // legitimate amount, untouched
    expect(neutralizeCsvFormula("-50")).toBe("-50");
  });

  it("leaves ordinary text and positive numbers untouched", () => {
    expect(neutralizeCsvFormula("Operating Expenses")).toBe("Operating Expenses");
    expect(neutralizeCsvFormula("1200")).toBe("1200");
    expect(neutralizeCsvFormula("")).toBe("");
  });
});

describe("toCsv — formula injection through the generic exporter", () => {
  it("neutralizes a malicious task title but keeps other cells intact", () => {
    const csv = toCsv([
      { title: '=cmd|"/c calc"!A1', status: "open", score: -5 },
    ]);
    // The dangerous cell is now literal text, not a formula.
    expect(csv).toContain("'=cmd");
    expect(csv).not.toContain(",=cmd"); // never appears bare after a delimiter
    // A genuine negative numeric stays a number.
    expect(csv).toContain("-5");
    expect(csv).not.toContain("'-5");
  });

  it("still escapes RFC-4180 special characters (regression guard)", () => {
    const csv = toCsv([{ note: 'has "quotes", and, commas' }]);
    expect(csv).toContain('"has ""quotes"", and, commas"');
  });
});
