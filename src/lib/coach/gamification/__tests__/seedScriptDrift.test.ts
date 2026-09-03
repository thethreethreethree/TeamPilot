import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POINTS_DIMENSIONS, RUBRIC_VERSION } from "../rubric";
import { BANDS, STRONG_SESSION_THRESHOLD, POINTS_SCALE_MAX, bandFor } from "../bands";

/**
 * DRIFT GUARD — scripts/seed-gamification-points.mjs re-implements the banking rules INLINE (its own COUNTED set,
 * bandFor thresholds, RUBRIC_VERSION, and the mean×10 formula) because a plain .mjs script can't easily import the
 * TS single-source. That duplication is the section-2.2 / A13 landmine the gamification memory warns about: "SoT is
 * bands.ts … NEVER re-derive a band boundary." If someone changes a boundary / the strong line / the counted
 * dimensions in the TS SoT and re-runs the seed, it would silently write WRONG bands to the ledger.
 *
 * This test reads the script as text and asserts its inline copies still agree with the SoT — so a future SoT
 * change that forgets the script fails CI here instead of corrupting a backfill. (feedback: convert a verified
 * invariant into a structural guard — ALWAYS detection-test; grep "keep in sync" → test they agree.)
 */
const SCRIPT = readFileSync(join(process.cwd(), "scripts/seed-gamification-points.mjs"), "utf8");

describe("seed-gamification-points.mjs does not drift from the gamification SoT", () => {
  it("COUNTED set matches rubric POINTS_DIMENSIONS", () => {
    const m = SCRIPT.match(/const\s+COUNTED\s*=\s*new Set\(\[([^\]]*)\]\)/);
    expect(m, "COUNTED = new Set([...]) not found in the script").toBeTruthy();
    const scriptDims = ((m?.[1] ?? "").match(/"([^"]+)"/g) ?? []).map((s) => s.replace(/"/g, ""));
    expect(new Set(scriptDims)).toEqual(new Set(POINTS_DIMENSIONS));
  });

  it("RUBRIC_VERSION literal matches the SoT", () => {
    const m = SCRIPT.match(/const\s+RUBRIC_VERSION\s*=\s*"([^"]+)"/);
    expect(m, "RUBRIC_VERSION not found in the script").toBeTruthy();
    expect(m![1]).toBe(RUBRIC_VERSION);
  });

  it("the script's inline bandFor produces the SAME band as the SoT bandFor for every point 0..100", () => {
    // Extract the ternary thresholds: p>=90?"elite":p>=80?"strong":... and rebuild the function to compare
    // behaviorally against the SoT across the whole range (catches ANY threshold drift, not just a text match).
    const line = SCRIPT.match(/bandFor\s*=\s*p\s*=>\s*([^;]+);/);
    expect(line, "inline bandFor not found in the script").toBeTruthy();
    const body = line?.[1] ?? "";
    const pairs = [...body.matchAll(/p>=(\d+)\?"([a-z_]+)"/g)].map((mm) => ({
      min: Number(mm[1]),
      band: String(mm[2]),
    }));
    // Trailing else band (…:"needs_coaching")
    const elseBand = body.match(/:"([a-z_]+)"\s*$/)?.[1] ?? "";
    expect(pairs.length, "expected 4 threshold branches in the inline bandFor").toBe(4);
    const scriptBandFor = (p: number): string => {
      for (const { min, band } of pairs) if (p >= min) return band;
      return elseBand;
    };
    for (let p = 0; p <= POINTS_SCALE_MAX; p++) {
      expect(scriptBandFor(p), `band mismatch at ${p} points`).toBe(bandFor(p));
    }
  });

  it("the strong-session threshold is represented in the script's bandFor (the 'strong' branch min)", () => {
    const body = SCRIPT.match(/bandFor\s*=\s*p\s*=>\s*([^;]+);/)?.[1] ?? "";
    const strong = [...body.matchAll(/p>=(\d+)\?"([a-z_]+)"/g)].find((mm) => mm[2] === "strong");
    expect(strong, "no 'strong' branch in the inline bandFor").toBeTruthy();
    expect(Number(strong?.[1])).toBe(STRONG_SESSION_THRESHOLD);
  });

  it("the points formula scales the 0-10 mean to the 0..POINTS_SCALE_MAX range (×10)", () => {
    // SoT: a 0-10 mean × 10 → 0..100. If POINTS_SCALE_MAX ever stops being 100, the ×10 in the script is wrong.
    expect(POINTS_SCALE_MAX).toBe(100);
    // mean over counted dims (reduce) then ×10 to reach the 0..100 scale.
    expect(SCRIPT).toMatch(/counted\.reduce\(/);
    expect(SCRIPT).toMatch(/\/\s*counted\.length\s*\*\s*10/);
  });

  it("the strong band's min equals the strong-session alert threshold (SoT internal consistency)", () => {
    const strongBand = BANDS.find((b) => b.band === "strong");
    expect(strongBand?.min).toBe(STRONG_SESSION_THRESHOLD);
  });
});
