import { describe, it, expect } from "vitest";
import { planReapply } from "../vocabularyReapply";

/** F8.9 re-apply (2026-11-26): only lines the corrections change, by the same rule new lines go through. */
describe("planReapply", () => {
  it("lists each call's changed lines with their corrected text; unchanged calls are left out", () => {
    const lines = [
      { session_id: "s1", seq: 1, text: "We moved from spec trum last year" },
      { session_id: "s1", seq: 2, text: "Nothing to fix here" },
      { session_id: "s2", seq: 1, text: "No mention" },
      { session_id: "s3", seq: 4, text: "SPEKTRUM was slow" },
    ];
    const plan = planReapply(lines, [{ term: "Spectrum", heard: ["spec trum", "spektrum"] }]);
    expect(plan).toEqual([
      { sessionId: "s1", texts: { "1": "We moved from Spectrum last year" } },
      { sessionId: "s3", texts: { "4": "Spectrum was slow" } },
    ]);
    expect(planReapply(lines, [])).toEqual([]);
  });
});
