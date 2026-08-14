import { describe, expect, it } from "vitest";
import { diagnoseAfterPitchRead, explainAfterPitchError } from "../afterPitchDiagnosis";

const talkCaveat = { key: "talk_ratio", caveat: true };
const talkOk = { key: "talk_ratio", caveat: false };

describe("diagnoseAfterPitchRead", () => {
  it("returns null for a HEALTHY read (narrative present) — nothing to diagnose", () => {
    expect(
      diagnoseAfterPitchRead({ summary: { narrative: { hasSignal: true }, scores: [talkOk] } })
    ).toBeNull();
  });

  it("returns null when there is no summary yet", () => {
    expect(diagnoseAfterPitchRead({ summary: null })).toBeNull();
  });

  it("returns NULL for a ONE-SIDED gap — BlankReadRecovery owns that cause (no duplicate)", () => {
    expect(
      diagnoseAfterPitchRead({ summary: { narrative: { hasSignal: false }, scores: [talkCaveat] } })
    ).toBeNull();
  });

  it("names the EMPTY-READ case (two-sided call, no gap, blank write-up)", () => {
    const issue = diagnoseAfterPitchRead({
      summary: { narrative: { hasSignal: false }, scores: [talkOk] },
    });
    expect(issue?.category).toBe("empty-read");
    expect(issue?.title.toLowerCase()).toContain("didn't come through");
  });

  it("returns null for a blank narrative with NO scores (the fully-blank state the page's own card handles)", () => {
    expect(
      diagnoseAfterPitchRead({ summary: { narrative: { hasSignal: false }, scores: [] } })
    ).toBeNull();
  });
});

describe("explainAfterPitchError", () => {
  it("504 / timeout → 'took too long' (the founder's 504 question)", () => {
    expect(explainAfterPitchError(504).title.toLowerCase()).toContain("too long");
    expect(explainAfterPitchError(408).title.toLowerCase()).toContain("too long");
    expect(explainAfterPitchError(null, "the request timed out").title.toLowerCase()).toContain("too long");
  });

  it("502 / 503 → transcription temporarily unavailable (audio safe)", () => {
    expect(explainAfterPitchError(502).title.toLowerCase()).toContain("transcription");
    expect(explainAfterPitchError(503).detail.toLowerCase()).toContain("saved");
  });

  it("403 → private to the rep", () => {
    expect(explainAfterPitchError(403).title.toLowerCase()).toContain("private");
  });

  it("429 → too many attempts", () => {
    expect(explainAfterPitchError(429).title.toLowerCase()).toContain("too many");
  });

  it("500 / unknown → a friendly generic hiccup (never a raw HTTP code)", () => {
    const e = explainAfterPitchError(500);
    expect(e.title.toLowerCase()).toContain("couldn't build");
    expect(e.detail.toLowerCase()).toContain("recording is safe");
  });
});
