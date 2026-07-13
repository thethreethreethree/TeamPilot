import { describe, it, expect } from "vitest";
import { isoAdd, priorRange, todayIso } from "@/lib/finance/dateRange";

describe("todayIso", () => {
  it("returns LOCAL today as YYYY-MM-DD (not UTC-today)", () => {
    const r = todayIso();
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Must match the local date components — a UTC-based impl (toISOString) would diverge from these
    // for an evening user in a negative-offset zone. This guards against reverting to that.
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(r).toBe(local);
  });
});

describe("isoAdd (timezone-safe)", () => {
  it("adding 0 round-trips to the same date — the timezone-bug regression guard", () => {
    // The old `new Date("2026-07-01")` parsed as UTC midnight, then read local components, so in a
    // negative-offset zone isoAdd(d, 0) returned the PREVIOUS day. The fix must return the same date
    // in every timezone.
    expect(isoAdd("2026-07-01", 0)).toBe("2026-07-01");
    expect(isoAdd("2026-01-01", 0)).toBe("2026-01-01");
    expect(isoAdd("2026-12-31", 0)).toBe("2026-12-31");
  });

  it("crosses month and year boundaries correctly", () => {
    expect(isoAdd("2026-07-01", -1)).toBe("2026-06-30"); // month boundary back
    expect(isoAdd("2026-07-31", 1)).toBe("2026-08-01");  // month boundary forward
    expect(isoAdd("2026-12-31", 1)).toBe("2027-01-01");  // year boundary forward
    expect(isoAdd("2026-01-01", -1)).toBe("2025-12-31"); // year boundary back
    expect(isoAdd("2028-03-01", -1)).toBe("2028-02-29"); // leap day
  });
});

describe("priorRange (period-over-period window)", () => {
  it("returns a same-length window ending the day before `from`", () => {
    // Current: Jul 1–31 (31 days). Prior: same 31-day span ending Jun 30 → May 31–Jun 30.
    expect(priorRange("2026-07-01", "2026-07-31")).toEqual({ from: "2026-05-31", to: "2026-06-30" });
  });

  it("never overlaps the current window", () => {
    const cur = { from: "2026-07-01", to: "2026-07-31" };
    const prior = priorRange(cur.from, cur.to);
    expect(prior.to < cur.from).toBe(true); // strictly before
  });

  it("matches the current window's day-count", () => {
    const days = (a: string, b: string) =>
      Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
    const prior = priorRange("2026-03-10", "2026-03-20"); // 10-day span
    expect(days(prior.from, prior.to)).toBe(days("2026-03-10", "2026-03-20"));
  });

  it("returns empty for missing bounds (no comparison)", () => {
    expect(priorRange("", "")).toEqual({ from: "", to: "" });
    expect(priorRange("2026-07-01", "")).toEqual({ from: "", to: "" });
  });
});
