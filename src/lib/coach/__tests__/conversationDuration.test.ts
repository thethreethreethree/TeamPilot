import { describe, it, expect } from "vitest";
import { conversationDurationSeconds, MAX_WALLCLOCK_SECONDS } from "@/lib/coach/conversationDuration";

/**
 * The shared "how long was this call" rule (audit F8) — the §3.5-critical prefer-audio logic that After-Pitch,
 * the Sessions list, and the KPI avg-duration metric all read. Previously hand-copied 3× and untested on 2 of
 * the 3 surfaces; this gate locks the rule so a future edit can't silently reintroduce the "62m for a 4m clip"
 * drift.
 */
describe("conversationDurationSeconds", () => {
  const start = "2026-08-11T10:00:00.000Z";
  const endPlus4m = "2026-08-11T10:04:00.000Z"; // wall-clock 240s

  it("prefers the audio length over the wall-clock (the upload fix)", () => {
    // A 4-min audio in a session that sat open ~62 min: return 240, NOT the wall-clock.
    const end62m = "2026-08-11T11:02:00.000Z";
    expect(conversationDurationSeconds(240, start, end62m)).toBe(240);
  });

  it("falls back to the wall-clock (raw seconds) when there is no audio length", () => {
    expect(conversationDurationSeconds(null, start, endPlus4m)).toBe(240);
    expect(conversationDurationSeconds(undefined, start, endPlus4m)).toBe(240);
  });

  it("treats audio 0 or negative as absent → wall-clock", () => {
    expect(conversationDurationSeconds(0, start, endPlus4m)).toBe(240);
    expect(conversationDurationSeconds(-5, start, endPlus4m)).toBe(240);
  });

  it("returns fractional wall-clock seconds RAW (each surface rounds/floors itself)", () => {
    const end = "2026-08-11T10:01:59.600Z"; // 119.6s
    expect(conversationDurationSeconds(null, start, end)).toBeCloseTo(119.6, 5);
  });

  it("returns null when neither a length nor a valid wall-clock is known (no fabricated number, §3.4)", () => {
    expect(conversationDurationSeconds(null, start, null)).toBeNull();
    expect(conversationDurationSeconds(null, null, endPlus4m)).toBeNull();
    expect(conversationDurationSeconds(0, start, null)).toBeNull();
  });

  it("guards a negative / NaN wall-clock span (clock skew / bad timestamps) → null", () => {
    // ended BEFORE started
    expect(conversationDurationSeconds(null, endPlus4m, start)).toBeNull();
    // unparseable timestamp → NaN span → null
    expect(conversationDurationSeconds(null, "not-a-date", endPlus4m)).toBeNull();
  });

  it("CAPS an implausible wall-clock (unclosed / backfilled ended_at) → null, the '32051.9 min' bug", () => {
    // The live incident: started in June, ended_at mass-backfilled to 2026-08-21 → ~54-day span.
    const backfilledEnd = "2026-08-21T00:28:33.175Z";
    const juneStart = "2026-06-27T06:45:36.508Z";
    expect(conversationDurationSeconds(null, juneStart, backfilledEnd)).toBeNull();
    // just over the cap → null; just under → the real span (a legit long session is kept)
    const capStart = "2026-08-11T00:00:00.000Z";
    const overCap = new Date(Date.parse(capStart) + (MAX_WALLCLOCK_SECONDS + 60) * 1000).toISOString();
    const underCap = new Date(Date.parse(capStart) + (MAX_WALLCLOCK_SECONDS - 60) * 1000).toISOString();
    expect(conversationDurationSeconds(null, capStart, overCap)).toBeNull();
    expect(conversationDurationSeconds(null, capStart, underCap)).toBeCloseTo(MAX_WALLCLOCK_SECONDS - 60, 5);
  });

  it("NEVER caps a real uploaded audio length (the cap is wall-clock-only)", () => {
    // A 3-hour uploaded meeting recording has a true audio length > the wall-clock cap edge cases — trust it.
    const fiveHours = 5 * 60 * 60;
    expect(conversationDurationSeconds(fiveHours, start, endPlus4m)).toBe(fiveHours);
  });
});
