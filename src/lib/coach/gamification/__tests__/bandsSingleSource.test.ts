import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANDS, BAND_LABEL, bandFor, bandForWire } from "../bands";

/**
 * The band boundaries exist ONCE. This is the gate for that, not a restatement of it.
 *
 * The Scoreboard carried its own copy for months, with a comment describing itself as a mirror of the server's.
 * It was not a mirror: `bandFor` rounds before classifying and the copy did not, so a rep whose average was 89.6
 * read "Elite" on their own Arena and "Strong" on the team board — the same week's work, two different verdicts,
 * and no way for them to tell which was true.
 *
 * A comment could not stop that returning. These tests can.
 */

describe("bandFor rounds before classifying", () => {
  it("89.6 is Elite, because the value being banded is an AVERAGE", () => {
    // The exact case the Scoreboard's local copy got wrong. Averages land on fractions constantly; this is the
    // ordinary case, not a corner one, which is why it went unreported rather than unnoticed.
    expect(bandFor(89.6)).toBe("elite");
    expect(BAND_LABEL[bandFor(89.6)]).toBe("Elite");
  });

  it("89.4 is still Strong — the rounding is real, not a shift of the boundary", () => {
    expect(bandFor(89.4)).toBe("strong");
  });

  it("every boundary rounds UP into its band, and only just below does not", () => {
    // My first version of this asserted the opposite and failed: 0.4 below a boundary rounds UP to it, so it IS
    // the higher band. Half-up rounding puts the real edge at min - 0.5, and the first value that misses is below
    // that. The test was wrong, not the code — recorded because it is the same mistake the Scoreboard's local copy
    // made, approached from the other side.
    for (const b of BANDS) {
      if (b.min === 0) continue;
      expect(bandFor(b.min - 0.4), `${b.band} at ${b.min - 0.4}`).toBe(b.band);
      expect(bandFor(b.min - 0.5), `${b.band} at ${b.min - 0.5}`).toBe(b.band);
      expect(bandFor(b.min - 0.6), `${b.band} at ${b.min - 0.6}`).not.toBe(b.band);
    }
  });

  it("clamps rather than falling off either end", () => {
    // A corrected total can go below zero; nothing should classify as undefined.
    expect(bandFor(-40)).toBe("needs_coaching");
    expect(bandFor(1000)).toBe("elite");
  });
});

describe("bandForWire — the boundary where a value arrives from PostgREST", () => {
  it("treats a numeric STRING as the number it is", () => {
    // avg_points is a `numeric`, and PostgREST serialises numeric as a string to preserve precision. Comparisons
    // coerce silently, which works right up until one string is compared to another.
    expect(bandForWire("89.6")).toBe("elite");
    expect(bandForWire("45")).toBe("developing");
    expect(bandForWire(89.6)).toBe(bandForWire("89.6"));
  });

  it("does not THROW on a missing average — which bandFor does", () => {
    // Math.round(undefined) is NaN, no band's range contains NaN, and the lookup's non-null assertion then
    // dereferences undefined. One board row without an average would take the whole Scoreboard down.
    expect(() => bandFor(undefined as unknown as number)).toThrow();
    expect(bandForWire(undefined)).toBe("needs_coaching");
    expect(bandForWire(null)).toBe("needs_coaching");
    expect(bandForWire("not a number")).toBe("needs_coaching");
  });
});

describe("no second copy of the boundaries", () => {
  /**
   * A source-level check, deliberately.
   *
   * The failure this guards was not a wrong value — it was a SECOND definition that drifted from the first. No
   * behavioural test can see that, because both copies pass their own tests; the only observable is that the two
   * files disagree, and that is visible in the source or nowhere.
   *
   * Narrow on purpose (A33): it looks for the band boundaries as literals in the components that render a band,
   * not for every number in the repo. A gate that cried wolf on unrelated numbers is one people would learn to
   * skip, and the real duplicate would ride in behind six false ones.
   */
  const SURFACES = [
    "src/components/sales-coach/Scoreboard.tsx",
    "src/components/sales-coach/RepArena.tsx",
    "src/components/sales-coach/MyProgress.tsx",
  ];

  for (const rel of SURFACES) {
    it(`${rel} does not re-derive a boundary`, () => {
      let src: string;
      try {
        src = readFileSync(join(process.cwd(), rel), "utf8");
      } catch {
        return; // a surface that no longer exists cannot hold a duplicate
      }
      // COMMENTS ARE NOT CODE, and my first version of this did not know that: it failed on RepArena's header,
      // which merely DESCRIBES the rule as "strong sessions (>=80)". That is a gate crying wolf on an accurate
      // comment — the exact failure A33 warns about, and the one this file warns about a few lines above. A gate
      // people learn to skip is worse than no gate, so the noise is removed rather than tolerated.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      for (const b of BANDS) {
        if (b.min === 0) continue;
        expect(
          code,
          `${rel} compares against the ${b.band} boundary (${b.min}) directly — import bandFor instead`,
        ).not.toMatch(new RegExp(`[><]=?\\s*${b.min}\\b`));
      }
    });
  }
});
