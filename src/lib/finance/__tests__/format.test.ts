import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/finance/format";

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
