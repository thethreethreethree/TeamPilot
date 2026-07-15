import { describe, it, expect } from "vitest";

/**
 * REFERENCE SPEC for migration 0186 (recurring-bill anchor-day drift fix).
 *
 * The SQL function fin_generate_recurring_bill is the source of truth; this mirrors its
 * date-advance ALGORITHM in JS so the clamp logic is testable without a live DB (the
 * one part of that migration that can't be verified by reading). If this test is right,
 * the SQL — which uses the identical first-of-target-month + least(anchor, days) clamp —
 * is right. These cases ARE the staging acceptance spec for 0186.
 *
 * The bug it fixes: `next_date + interval '1 month'` drifts (Jan31→Feb28→Mar28→…). The
 * fix re-anchors from a STORED anchor_day each period, so a short-month clamp is a
 * one-period detour, never a permanent slide.
 */
type Freq = "weekly" | "monthly" | "quarterly" | "annual";

/** Mirror of the SQL: advance `current` to `anchorDay` of the target period, clamped to
 *  that month's last day. Weekly is exact (+7). All UTC to match SQL `date`. */
function nextRecurrenceDate(current: Date, anchorDay: number, freq: Freq): Date {
  if (freq === "weekly") {
    const d = new Date(current);
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  const monthsToAdd = freq === "monthly" ? 1 : freq === "quarterly" ? 3 : 12;
  // first day of the target month (month overflow rolls the year, like SQL)
  const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + monthsToAdd, 1));
  // last day of the target month: day 0 of the NEXT month
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(anchorDay, daysInMonth);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (s: string) => new Date(`${s}T00:00:00Z`);

describe("recurring-bill anchor-day advance (migration 0186 reference)", () => {
  it("does NOT drift: anchor 31 monthly re-anchors after a February clamp", () => {
    // The exact bug: old code did Jan31→Feb28→Mar28. Anchor-day: Feb28→Mar31.
    expect(iso(nextRecurrenceDate(D("2025-01-31"), 31, "monthly"))).toBe("2025-02-28"); // clamp
    expect(iso(nextRecurrenceDate(D("2025-02-28"), 31, "monthly"))).toBe("2025-03-31"); // RE-ANCHOR
    expect(iso(nextRecurrenceDate(D("2025-03-31"), 31, "monthly"))).toBe("2025-04-30"); // clamp
    expect(iso(nextRecurrenceDate(D("2025-04-30"), 31, "monthly"))).toBe("2025-05-31"); // RE-ANCHOR
  });

  it("anchor 30 holds at 30 except in February", () => {
    expect(iso(nextRecurrenceDate(D("2025-01-30"), 30, "monthly"))).toBe("2025-02-28");
    expect(iso(nextRecurrenceDate(D("2025-02-28"), 30, "monthly"))).toBe("2025-03-30");
  });

  it("mid-month anchors never clamp", () => {
    expect(iso(nextRecurrenceDate(D("2025-01-15"), 15, "monthly"))).toBe("2025-02-15");
    expect(iso(nextRecurrenceDate(D("2025-02-15"), 15, "monthly"))).toBe("2025-03-15");
  });

  it("year rollover (Dec → Jan) keeps the anchor", () => {
    expect(iso(nextRecurrenceDate(D("2025-12-31"), 31, "monthly"))).toBe("2026-01-31");
  });

  it("weekly is exact (+7), no clamp", () => {
    expect(iso(nextRecurrenceDate(D("2025-01-28"), 28, "weekly"))).toBe("2025-02-04");
  });

  it("quarterly re-anchors across the clamp", () => {
    // 31 → +3mo = Apr 30 (clamp) → +3mo = Jul 31 (re-anchor)
    expect(iso(nextRecurrenceDate(D("2025-01-31"), 31, "quarterly"))).toBe("2025-04-30");
    expect(iso(nextRecurrenceDate(D("2025-04-30"), 31, "quarterly"))).toBe("2025-07-31");
  });

  it("annual: Feb 29 (leap) anchors to Feb 28 in a non-leap year, recovers on the next leap", () => {
    expect(iso(nextRecurrenceDate(D("2024-02-29"), 29, "annual"))).toBe("2025-02-28"); // clamp
    expect(iso(nextRecurrenceDate(D("2027-02-28"), 29, "annual"))).toBe("2028-02-29"); // re-anchor (leap)
  });
});
