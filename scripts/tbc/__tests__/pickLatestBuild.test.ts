import { describe, it, expect } from "vitest";
// @ts-expect-error — plain ESM helper, no types
import { pickLatestBuildName } from "../lib.mjs";

/**
 * pickLatestBuildName is the fix for the TBC gate's lexicographic-sort blind spot (2026-08-13): currentBuildDir
 * used to take the lexicographically-last NAME, so a newer dir whose name sorted EARLIER on the same day was
 * silently skipped — the gate validated the wrong build and shipped an unvalidated record. This locks the
 * "newest started_at wins, regardless of name" contract so that can't regress.
 */
describe("pickLatestBuildName", () => {
  it("THE REGRESSION — a newer build whose NAME sorts earlier still wins (by started_at)", () => {
    // "display-honesty" < "forced-client-update" lexicographically, but started 30 min LATER → it must win.
    const entries = [
      { name: "2026-08-13-forced-client-update", started: "2026-08-13T09:30:00Z" },
      { name: "2026-08-13-display-honesty", started: "2026-08-13T10:00:00Z" },
    ];
    expect(pickLatestBuildName(entries)).toBe("2026-08-13-display-honesty");
  });

  it("orders by started_at across days, not name", () => {
    const entries = [
      { name: "2026-08-13-aaa", started: "2026-08-13T08:00:00Z" },
      { name: "2026-08-12-zzz", started: "2026-08-12T23:00:00Z" },
    ];
    expect(pickLatestBuildName(entries)).toBe("2026-08-13-aaa");
  });

  it("a dir WITHOUT a started_at never beats a real build (can't hijack the selection)", () => {
    const entries = [
      { name: "2026-08-13-real", started: "2026-08-13T09:00:00Z" },
      { name: "zzzz-malformed-no-frontmatter", started: "" },
    ];
    expect(pickLatestBuildName(entries)).toBe("2026-08-13-real");
  });

  it("falls back to name order only when NO dir has a started_at", () => {
    const entries = [
      { name: "2026-08-13-a", started: "" },
      { name: "2026-08-13-b", started: "" },
    ];
    expect(pickLatestBuildName(entries)).toBe("2026-08-13-b");
  });

  it("returns null for no builds", () => {
    expect(pickLatestBuildName([])).toBeNull();
  });

  /**
   * The two defects found 2026-09-21. Both let the gate validate the WRONG build and ship an unvalidated
   * record -- the same outcome as the 2026-08-13 lexicographic bug these tests were written to lock out,
   * reached through the timestamp instead of through the name. Every test above uses a `Z` offset, which is
   * why neither was caught: the string sort is only wrong when the offsets DIFFER.
   */
  describe("started_at is an instant, not a string", () => {
    const NOW = Date.parse("2026-09-30T00:00:00Z");

    it("compares across OFFSETS, so +08:00 does not lose to an earlier Z that means a later moment", () => {
      // 09:30+08:00 is 01:30Z -- EARLIER than 02:00Z. Sorted as text, "09:30:00+08:00" > "02:00:00Z" and the
      // wrong dir wins.
      const entries = [
        { name: "2026-09-22-offset", started: "2026-09-22T09:30:00+08:00" },
        { name: "2026-09-22-zulu", started: "2026-09-22T02:00:00Z" },
      ];
      expect(pickLatestBuildName(entries, NOW)).toBe("2026-09-22-zulu");
    });

    it("an unparseable started_at is treated as absent, not as a giant string", () => {
      const entries = [
        { name: "2026-09-22-real", started: "2026-09-22T02:00:00Z" },
        { name: "2026-09-22-garbage", started: "whenever" },
      ];
      expect(pickLatestBuildName(entries, NOW)).toBe("2026-09-22-real");
    });
  });

  describe("a build dated in the FUTURE has not started", () => {
    const NOW = Date.parse("2026-09-21T10:18:00Z"); // the real clock when this was found

    it("THE REGRESSION -- a future-dated dir does not shadow the honest build that follows it", () => {
      // self-elo shipped at 18:11+08 (10:11Z) declaring a 09:30+08 start on the 22nd. Every later build was
      // skipped by the selection while its record still passed tbc:freshness.
      const entries = [
        { name: "2026-09-22-self-elo", started: "2026-09-22T09:30:00+08:00" },
        { name: "2026-09-21-started-at-is-a-clock", started: "2026-09-21T18:17:00+08:00" },
      ];
      expect(pickLatestBuildName(entries, NOW)).toBe("2026-09-21-started-at-is-a-clock");
    });

    it("demotes to the name tier rather than vanishing, so a selection always exists", () => {
      // If nothing real is present the gate must still have a dir to validate -- returning null would make
      // tbc:manifest fail with "no build directory" and hide the actual problem.
      const entries = [
        { name: "2026-09-22-a", started: "2026-09-22T09:30:00+08:00" },
        { name: "2026-09-22-b", started: "2026-09-22T10:30:00+08:00" },
      ];
      expect(pickLatestBuildName(entries, NOW)).toBe("2026-09-22-b");
    });

    it("a REAL timestamp still outranks a malformed dir even when it parses NEGATIVE", () => {
      // Found by mutation: dropping the tier and sorting on the instant alone passed every test above,
      // because a demoted dir is keyed 0 and every real build is a large positive number. The tier only
      // earns its place below the epoch -- which a transposed year reaches ("0202" for "2026"). The
      // original contract is that ANY real timestamp beats a nameless dir; a typo must not invert it.
      const entries = [
        { name: "2026-09-21-zzz-malformed", started: "" },
        { name: "0202-09-21-typo", started: "0202-09-21T10:00:00Z" },
      ];
      expect(pickLatestBuildName(entries, NOW)).toBe("0202-09-21-typo");
    });

    it("a start on this exact instant counts as started", () => {
      const entries = [
        { name: "2026-09-21-now", started: new Date(NOW).toISOString() },
        { name: "2026-09-21-earlier", started: "2026-09-21T09:00:00Z" },
      ];
      expect(pickLatestBuildName(entries, NOW)).toBe("2026-09-21-now");
    });
  });
});
