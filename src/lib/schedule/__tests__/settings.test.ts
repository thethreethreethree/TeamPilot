import { describe, it, expect, vi, afterEach } from "vitest";
import { getScheduleSettings, todayInTz, DEFAULT_SCHEDULE_SETTINGS } from "../settings";

/**
 * Company schedule settings (RQ4 / RQ7). Pins: the guarded fallback (missing column / thrown query / bad
 * value → the UTC/Monday defaults, never a crash), a valid read is passed through, and todayInTz formats a
 * real YYYY-MM-DD in the given zone and survives a bad zone.
 */

// Minimal sb whose companies read returns a chosen maybeSingle result (or throws).
type SingleResult = { data: unknown; error: unknown };
function sbReturning(result: SingleResult | (() => never)) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (typeof result === "function" ? result() : result),
        }),
      }),
    }),
  } as unknown as Parameters<typeof getScheduleSettings>[0];
}

describe("getScheduleSettings — guarded fallback", () => {
  it("passes a valid row through", async () => {
    const s = await getScheduleSettings(sbReturning({ data: { timezone: "America/New_York", workweek_start: 0 }, error: null }), "c1");
    expect(s).toEqual({ timezone: "America/New_York", workweekStart: 0 });
  });

  it("no row → defaults (UTC / Monday)", async () => {
    expect(await getScheduleSettings(sbReturning({ data: null, error: null }), "c1")).toEqual(DEFAULT_SCHEDULE_SETTINGS);
  });

  it("missing-column error (migration not applied) → defaults", async () => {
    const s = await getScheduleSettings(sbReturning({ data: null, error: { code: "42703", message: 'column companies.timezone does not exist' } }), "c1");
    expect(s).toEqual(DEFAULT_SCHEDULE_SETTINGS);
  });

  it("a thrown query never crashes the caller → defaults", async () => {
    const s = await getScheduleSettings(sbReturning(() => { throw new Error("boom"); }), "c1");
    expect(s).toEqual(DEFAULT_SCHEDULE_SETTINGS);
  });

  it("coerces an invalid timezone and out-of-range workweek_start to the defaults", async () => {
    const s = await getScheduleSettings(sbReturning({ data: { timezone: "Not/AZone", workweek_start: 9 }, error: null }), "c1");
    expect(s).toEqual(DEFAULT_SCHEDULE_SETTINGS);
  });
});

describe("todayInTz", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("returns a YYYY-MM-DD string for a real zone", () => {
    expect(todayInTz("America/New_York")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to a valid date for a bogus zone (never throws)", () => {
    expect(todayInTz("Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("actually shifts the CALENDAR DATE by zone (the whole point) — not just the clock", () => {
    // 02:00 UTC on 2026-08-19. In New York (UTC-4 in August DST) it is still 22:00 on 2026-08-18;
    // in Tokyo (UTC+9) it is already 11:00 on 2026-08-19. Same instant, different calendar day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T02:00:00Z"));
    expect(todayInTz("UTC")).toBe("2026-08-19");
    expect(todayInTz("America/New_York")).toBe("2026-08-18"); // the fix: "today" is the PREVIOUS day there
    expect(todayInTz("Asia/Tokyo")).toBe("2026-08-19");
  });
});
