import { describe, it, expect } from "vitest";
import { aggregateMeetingDissects } from "../aggregateMeetingDissects";

/**
 * The trend is a team's RECENT half vs its EARLIER half (no control baseline exists — cues run day-1), read from
 * the owned-action + focused ratios. §3.4/§3.6: below MIN_FOR_TREND meetings it must say "insufficient", not fake
 * a curve; defensive on malformed payloads.
 */
const row = (p: unknown, created_at = "2026-08-22T00:00:00Z") => ({ payload: p, created_at });
// newest-first: front rows are "recent", back rows are "earlier".
const good = { decisions: [{ decision: "d" }], actions: [{ action: "a", owner: "Dana" }], open_items: [], effectiveness: { focused: true } };
const bad = { decisions: [{ decision: "d" }], actions: [{ action: "a", owner: null }], open_items: [{ item: "x" }], effectiveness: { focused: false } };

describe("aggregateMeetingDissects", () => {
  it("says 'insufficient' below the minimum, but still computes overall", () => {
    const t = aggregateMeetingDissects([row(good), row(good)]);
    expect(t.direction).toBe("insufficient");
    expect(t.recent).toBeNull();
    expect(t.overall.meetings).toBe(2);
    expect(t.overall.ownedActionRatio).toBe(1);
  });

  it("reads 'improving' when recent owned+focused ratios beat the earlier half", () => {
    const t = aggregateMeetingDissects([row(good), row(good), row(bad), row(bad)]);
    expect(t.direction).toBe("improving");
    expect(t.recent?.ownedActionRatio).toBe(1);
    expect(t.earlier?.ownedActionRatio).toBe(0);
    expect(t.recent?.focusedRatio).toBe(1);
    expect(t.earlier?.focusedRatio).toBe(0);
  });

  it("reads 'declining' when recent is worse than earlier", () => {
    const t = aggregateMeetingDissects([row(bad), row(bad), row(good), row(good)]);
    expect(t.direction).toBe("declining");
  });

  it("reads 'flat' when the quality ratios don't move beyond tolerance", () => {
    const t = aggregateMeetingDissects([row(good), row(good), row(good), row(good)]);
    expect(t.direction).toBe("flat");
  });

  it("computes overall metrics honestly (owned ratio, open items, decisions/meeting)", () => {
    const t = aggregateMeetingDissects([row(good), row(bad)]);
    expect(t.overall.decisionsPerMeeting).toBe(1);
    expect(t.overall.ownedActionRatio).toBe(0.5); // one owned, one not
    expect(t.overall.openItemsPerMeeting).toBe(0.5); // bad has 1 open item, good has 0
    expect(t.overall.focusedRatio).toBe(0.5);
    expect(t.lastAt).toBe("2026-08-22T00:00:00Z");
  });

  it("nulls ratios when nothing was recorded, and never throws on malformed payloads", () => {
    const t = aggregateMeetingDissects([row({ decisions: [] }), row(null), row("garbage"), row({ actions: "nope" })]);
    expect(t.overall.ownedActionRatio).toBeNull();
    expect(t.overall.focusedRatio).toBeNull();
    expect(t.overall.decisionsPerMeeting).toBe(0);
    expect(t.direction).toBe("flat"); // 4 rows, but ratios null → deltas 0 → flat
  });
});
