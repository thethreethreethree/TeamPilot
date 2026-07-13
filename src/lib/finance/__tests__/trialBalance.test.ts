import { describe, it, expect } from "vitest";
import { parseTrialBalance, tbImbalance } from "../trialBalance";

const ACC = [
  { id: "a1", code: "1000" },
  { id: "a2", code: "2000" },
  { id: "a3", code: "3100" },
];

describe("parseTrialBalance", () => {
  it("parses a normal trial balance", () => {
    const { lines, bad } = parseTrialBalance("1000,10000,0\n2000,0,3000\n3100,0,7000", ACC);
    expect(bad).toEqual([]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ code: "1000", debit: 10000, credit: 0, accountId: "a1" });
  });

  // The bug that already bit this codebase once: Excel writes a BOM, it corrupts the first code, the
  // account silently fails to match, and it vanishes from the import.
  it("strips the BOM so the first account is not silently lost", () => {
    const { lines, bad } = parseTrialBalance("﻿1000,10000,0", ACC);
    expect(bad).toEqual([]);
    expect(lines[0]?.accountId).toBe("a1");
  });

  // The other bug already paid for: a dropped row produces an import that LOOKS complete.
  it("reports an unknown account code instead of dropping the row", () => {
    const { lines, bad } = parseTrialBalance("1000,100,0\n9999,50,0", ACC);
    expect(lines).toHaveLength(1);
    expect(bad).toEqual(["9999,50,0"]); // named, not skipped
  });

  it("refuses to invent an account rather than importing a hole", () => {
    const { lines } = parseTrialBalance("9999,50,0", ACC);
    expect(lines).toHaveLength(0);
  });

  it("rejects a line that is both a debit and a credit, and one that is neither", () => {
    const { lines, bad } = parseTrialBalance("1000,100,100\n2000,0,0", ACC);
    expect(lines).toHaveLength(0);
    expect(bad).toHaveLength(2);
  });

  // An unparseable figure read as 0 is a WRONG BALANCE, posted silently. It must be reported instead.
  it("reports an unreadable amount rather than reading it as zero", () => {
    const { lines, bad } = parseTrialBalance("1000,abc,0", ACC);
    expect(lines).toHaveLength(0);
    expect(bad).toEqual(["1000,abc,0"]);
  });

  it("skips an unmistakable header row without treating it as an error", () => {
    const { lines, bad } = parseTrialBalance("code,debit,credit\n1000,100,0", ACC);
    expect(bad).toEqual([]);
    expect(lines).toHaveLength(1);
  });

  it("accepts tabs and semicolons, and tolerates quoted codes", () => {
    const { lines, bad } = parseTrialBalance("'1000'\t100\t0\n2000;0;100", ACC);
    expect(bad).toEqual([]);
    expect(lines).toHaveLength(2);
  });

  it("handles currency symbols and thousands separators", () => {
    const { lines } = parseTrialBalance("1000,\"$10,000.00\",0", ACC);
    expect(lines[0]?.debit).toBe(10000);
  });
});

describe("tbImbalance", () => {
  it("is zero when the source balances", () => {
    const { lines } = parseTrialBalance("1000,10000,0\n2000,0,3000\n3100,0,7000", ACC);
    expect(tbImbalance(lines)).toBe(0);
  });

  // THE CENTRAL ASSERTION. An imbalanced source must REPORT its imbalance — not be quietly corrected into
  // a clean, balanced, fictional position that every downstream check would then endorse forever.
  it("surfaces the gap when the source does NOT balance", () => {
    const { lines } = parseTrialBalance("1000,10000,0\n2000,0,3000\n3100,0,6500", ACC);
    expect(tbImbalance(lines)).toBe(500);
  });

  it("surfaces a credit-heavy gap as a negative", () => {
    const { lines } = parseTrialBalance("1000,9000,0\n2000,0,9500", ACC);
    expect(tbImbalance(lines)).toBe(-500);
  });
});
