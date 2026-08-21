import { describe, it, expect } from "vitest";
import { toCoachingCuesMode } from "../persistCueMode";
import type { CueMode } from "../coachingStrategy";

/**
 * Drift-guard for the wiring-spec Step-5 integration landmine: coaching_cues.mode is CHECK('suggestion',
 * 'guide_response') (0070:85), but a meeting CueDecision can carry 'directive'. This asserts EVERY CueMode maps
 * into the CHECK vocabulary — so no meeting cue can ever produce an out-of-CHECK insert that throws in prod.
 * ALL_MODES is exhaustive by construction: if a CueMode value is added, the `satisfies` forces this list to be
 * updated, and the loop then proves the new value is mapped safely.
 */
const ALL_MODES = ["suggestion", "directive"] as const satisfies readonly CueMode[];
const ALLOWED = new Set(["suggestion", "guide_response"]);

describe("toCoachingCuesMode — no CueMode escapes the coaching_cues CHECK", () => {
  it("maps every CueMode into the allowed vocabulary", () => {
    for (const m of ALL_MODES) {
      expect(ALLOWED.has(toCoachingCuesMode(m))).toBe(true);
    }
  });

  it("maps directive → guide_response and suggestion → suggestion", () => {
    expect(toCoachingCuesMode("directive")).toBe("guide_response");
    expect(toCoachingCuesMode("suggestion")).toBe("suggestion");
  });
});
