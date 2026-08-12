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
});
