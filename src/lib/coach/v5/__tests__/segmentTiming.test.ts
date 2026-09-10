import { describe, it, expect } from "vitest";
import { MAX_OFFSET_SECONDS, spokenAtFor } from "../segmentTiming";

describe("spokenAtFor", () => {
  const base = "2026-09-10T12:00:00.000Z";

  it("joins the audio offset to the session's own clock", () => {
    expect(spokenAtFor(base, 0)).toBe("2026-09-10T12:00:00.000Z");
    expect(spokenAtFor(base, 90)).toBe("2026-09-10T12:01:30.000Z");
    expect(spokenAtFor(base, 1.5)).toBe("2026-09-10T12:00:01.500Z");
  });

  it("preserves the GAPS, which is the only thing the pace score reads", () => {
    // agentWpm measures a turn as the gap to the NEXT timed segment, so what has
    // to survive is the spacing, not the absolute time.
    const a = Date.parse(spokenAtFor(base, 10)!);
    const b = Date.parse(spokenAtFor(base, 22.5)!);
    expect(b - a).toBe(12500);
  });

  it("returns null rather than stamping a segment with the start of the call", () => {
    // A missing offset stamped as the base would make the NEXT turn's gap
    // measure from a time nobody spoke at — a wrong pace, which is worse than
    // no pace on a skill whose whole claim is that it is measured.
    expect(spokenAtFor(base, null)).toBeNull();
    expect(spokenAtFor(base, undefined)).toBeNull();
    expect(spokenAtFor(base, NaN)).toBeNull();
    expect(spokenAtFor(base, "12" as unknown as number)).toBeNull();
  });

  it("refuses a corrupt offset instead of writing a timestamp tomorrow", () => {
    expect(spokenAtFor(base, -1)).toBeNull();
    expect(spokenAtFor(base, MAX_OFFSET_SECONDS + 1)).toBeNull();
    expect(spokenAtFor(base, MAX_OFFSET_SECONDS)).not.toBeNull();
  });

  it("refuses an unusable base", () => {
    expect(spokenAtFor(null, 10)).toBeNull();
    expect(spokenAtFor("", 10)).toBeNull();
    expect(spokenAtFor("not a date", 10)).toBeNull();
  });
});
