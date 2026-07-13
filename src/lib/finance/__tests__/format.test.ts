import { describe, it, expect } from "vitest";
import { formatMoney, computeLineTax } from "@/lib/finance/format";

describe("formatMoney", () => {
  it("always shows exactly two decimals", () => {
    expect(formatMoney(5)).toBe("$5.00");
    expect(formatMoney(5.1)).toBe("$5.10");
    expect(formatMoney(5.125)).toBe("$5.13"); // rounds to cents
  });

  it("groups thousands (the consistency fix vs bare toFixed)", () => {
    expect(formatMoney(1234567)).toBe("$1,234,567.00");
    expect(formatMoney(1000)).toBe("$1,000.00");
  });

  it("handles negatives", () => {
    expect(formatMoney(-1234.5)).toBe("$-1,234.50");
  });

  it("renders nullish / non-finite as $0.00, never $NaN", () => {
    expect(formatMoney(null)).toBe("$0.00");
    expect(formatMoney(undefined)).toBe("$0.00");
    expect(formatMoney(NaN)).toBe("$0.00");
    expect(formatMoney(0)).toBe("$0.00");
  });
});

describe("computeLineTax (bill/invoice line tax auto-calc)", () => {
  it("computes tax = amount × rate%, to 2 decimals", () => {
    expect(computeLineTax(100, 20)).toBe("20.00"); // 20% VAT on 100
    expect(computeLineTax(200, 8.25)).toBe("16.50"); // 8.25% sales tax
    expect(computeLineTax(0, 20)).toBe("0.00");
    expect(computeLineTax(100, 0)).toBe("0.00"); // no rate → no tax
  });

  it("accepts the amount as a string (the line field's shape)", () => {
    expect(computeLineTax("100", 20)).toBe("20.00");
    expect(computeLineTax("99.99", 10)).toBe("10.00"); // 9.999 rounds to 10.00
  });

  it("yields 0.00 for non-finite / empty inputs, never NaN", () => {
    expect(computeLineTax("", 20)).toBe("0.00");
    expect(computeLineTax(null, 20)).toBe("0.00");
    expect(computeLineTax(100, null)).toBe("0.00");
    expect(computeLineTax("abc", 20)).toBe("0.00");
    expect(computeLineTax(undefined, undefined)).toBe("0.00");
  });
});
