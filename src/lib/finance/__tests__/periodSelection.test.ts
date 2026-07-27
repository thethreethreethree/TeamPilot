import { describe, it, expect } from "vitest";
import { periodContainsDate, findOpenPeriodContaining, type SelectablePeriod } from "../periodSelection";

const p = (id: string, start: string, end: string, status = "open"): SelectablePeriod => ({
  id,
  status,
  start_date: start,
  end_date: end,
});

describe("periodContainsDate — inclusive boundaries", () => {
  const june = { start_date: "2026-06-01", end_date: "2026-06-30" };

  it("date inside the period", () => {
    expect(periodContainsDate(june, "2026-06-15")).toBe(true);
  });
  it("date exactly on start_date is inside (inclusive)", () => {
    expect(periodContainsDate(june, "2026-06-01")).toBe(true);
  });
  it("date exactly on end_date is inside (inclusive)", () => {
    expect(periodContainsDate(june, "2026-06-30")).toBe(true);
  });
  it("the day before start is outside", () => {
    expect(periodContainsDate(june, "2026-05-31")).toBe(false);
  });
  it("the day after end is outside", () => {
    expect(periodContainsDate(june, "2026-07-01")).toBe(false);
  });
});

describe("findOpenPeriodContaining — the H1 fix: contain the date, never grab an arbitrary open period", () => {
  // Periods arrive ordered start_date DESC (most-recent first), which is why periods[0] was the bug.
  const periods = [p("jul", "2026-07-01", "2026-07-31"), p("jun", "2026-06-01", "2026-06-30")];

  it("picks the period CONTAINING the date, not periods[0]", () => {
    // A back-dated June entry must NOT default into July (periods[0]).
    expect(findOpenPeriodContaining(periods, "2026-06-15")?.id).toBe("jun");
  });

  it("picks periods[0] only when it genuinely contains the date", () => {
    expect(findOpenPeriodContaining(periods, "2026-07-15")?.id).toBe("jul");
  });

  it("returns undefined when NO open period contains the date (the honest block-the-post state)", () => {
    // May: no period covers it -> undefined -> caller's 'No open period' guard fires.
    expect(findOpenPeriodContaining(periods, "2026-05-15")).toBeUndefined();
  });

  it("skips a CLOSED period that contains the date (must not post into a closed period)", () => {
    const withClosedJun = [p("jul", "2026-07-01", "2026-07-31"), p("jun", "2026-06-01", "2026-06-30", "closed")];
    expect(findOpenPeriodContaining(withClosedJun, "2026-06-15")).toBeUndefined();
  });

  it("honors inclusive start boundary", () => {
    expect(findOpenPeriodContaining(periods, "2026-07-01")?.id).toBe("jul");
  });
  it("honors inclusive end boundary", () => {
    expect(findOpenPeriodContaining(periods, "2026-06-30")?.id).toBe("jun");
  });

  it("empty period list -> undefined", () => {
    expect(findOpenPeriodContaining([], "2026-06-15")).toBeUndefined();
  });

  it("a single year-long period (the default seed) contains any date within the year", () => {
    const year = [p("2026", "2026-01-01", "2026-12-31")];
    expect(findOpenPeriodContaining(year, "2026-03-09")?.id).toBe("2026");
    expect(findOpenPeriodContaining(year, "2027-01-01")).toBeUndefined();
  });
});
