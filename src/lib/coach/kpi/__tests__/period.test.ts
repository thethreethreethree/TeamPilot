import { describe, it, expect } from "vitest";
import { inPeriod, parsePeriod, PERIOD_METRICS } from "../period";

describe("KPI period (F23.8)", () => {
  it("parses 30 and 90; anything else is all time", () => {
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("7")).toBeNull();
    expect(parsePeriod(null)).toBeNull();
  });
  it("keeps sessions started in the window", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    const rows = [{ startedAt: "2026-11-20T00:00:00Z" }, { startedAt: "2026-08-01T00:00:00Z" }];
    expect(inPeriod(rows, 30, now)).toHaveLength(1);
    expect(inPeriod(rows, null, now)).toHaveLength(2);
  });
  it("quota and progression never follow the period (founder: outcome numbers only)", () => {
    expect(PERIOD_METRICS).not.toContain("quotaAttainment");
    expect(PERIOD_METRICS).not.toContain("skillProgression");
  });
});
