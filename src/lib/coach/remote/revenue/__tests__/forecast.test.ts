import { describe, it, expect } from "vitest";
import { accuracyBand, accuracyOverQuarter, latest, metrics, periodOf, periodRange, rollUp, shiftPeriod, type Submission } from "../forecast";

/** The forecast board (0376; Gong M22): quarters, computed columns, the latest submission, roll-up, accuracy. */
describe("quarters", () => {
  it("of a date, its range, and stepping across a year", () => {
    expect(periodOf("2026-11-27")).toBe("2026-Q4");
    expect(periodRange("2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(periodRange("2028-Q1")).toEqual({ start: "2028-01-01", end: "2028-03-31" });
    expect(shiftPeriod("2026-Q4", 1)).toBe("2027-Q1");
    expect(shiftPeriod("2026-Q1", -1)).toBe("2025-Q4");
  });
});

describe("metrics", () => {
  const deals = [
    { repId: "a", status: "won" as const, amount: 1000, closedAt: "2026-11-02T10:00:00Z" },
    { repId: "a", status: "won" as const, amount: 500, closedAt: "2026-09-30T10:00:00Z" }, // last quarter
    { repId: "a", status: "open" as const, amount: 300, closeDate: "2026-12-15" },
    { repId: "a", status: "open" as const, amount: null, closeDate: "2026-12-20" },
    { repId: "b", status: "open" as const, amount: 900, closeDate: "2027-01-10" }, // next quarter
  ];
  it("closed won counts by when it closed; open by its expected close date; no amount is counted apart", () => {
    expect(metrics(deals, "2026-Q4", "a")).toEqual({ closedWon: 1000, closedWonCount: 1, openClosing: 300, openClosingCount: 2, openUnpriced: 1 });
    expect(metrics(deals, "2026-Q4").openClosing).toBe(300);
  });
});

describe("submissions", () => {
  const s = (userId: string, amount: number, createdAt: string, category: "commit" | "best_case" = "commit"): Submission => ({ userId, period: "2026-Q4", category, amount, createdAt });
  const subs = [s("a", 100, "2026-10-05T00:00:00Z"), s("a", 150, "2026-11-10T00:00:00Z"), s("b", 50, "2026-10-20T00:00:00Z"), s("a", 400, "2026-11-11T00:00:00Z", "best_case")];
  it("the latest per person and column is their forecast", () => {
    expect(latest(subs, "a", "2026-Q4", "commit")?.amount).toBe(150);
    expect(latest(subs, "c", "2026-Q4", "commit")).toBeNull();
  });
  it("a team rolls up its people's latest numbers, and says how many submitted", () => {
    expect(rollUp(subs, ["a", "b", "c"], "2026-Q4", "commit")).toEqual({ amount: 200, submitted: 2, of: 3 });
  });
  it("accuracy: Gong's bands; nothing closed is no ratio", () => {
    expect(accuracyBand(100, 100)?.band).toBe("green");
    expect(accuracyBand(80, 100)?.band).toBe("pink");
    expect(accuracyBand(125, 100)?.band).toBe("pink");
    expect(accuracyBand(50, 100)?.band).toBe("red");
    expect(accuracyBand(100, 0)).toBeNull();
  });
  it("accuracy over a quarter: the commit standing each week, from the first week anything was submitted", () => {
    const weeks = accuracyOverQuarter(subs, "a", "2026-Q4", 150);
    expect(weeks[0]).toEqual({ asOf: "2026-10-07", forecast: 100, accuracy: { ratio: 100 / 150, band: "red" } });
    expect(weeks.at(-1)).toMatchObject({ forecast: 150, accuracy: { band: "green" } });
  });
});
