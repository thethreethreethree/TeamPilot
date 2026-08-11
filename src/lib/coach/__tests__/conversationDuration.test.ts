import { describe, it, expect } from "vitest";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";

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
});
