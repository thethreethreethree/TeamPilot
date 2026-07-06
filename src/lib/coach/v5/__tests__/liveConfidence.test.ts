import { describe, expect, it } from "vitest";
import { computeConfidence } from "../liveConfidence";

const steadyStress = [
  { filler: false, pace: false },
  { filler: false, pace: false },
  { filler: false, pace: false },
];

describe("computeConfidence — customerAudible (video mic-only ripple guard)", () => {
  it("in-person: a lopsided talk-share DOES flag over-talking / wavering", () => {
    const c = computeConfidence({
      recentStress: steadyStress,
      repWords: 100,
      customerWords: 5, // rep dominates and the prospect IS audible
      customerAudible: true,
    });
    expect(c.overTalking).toBe(true);
    expect(c.level).toBe("wavering");
    expect(c.talkShareKnown).toBe(true);
  });

  it("video mic-only: talk-share is NOT a signal — no false over-talking", () => {
    // The bug this guards: video forces every turn to the rep, so customerWords
    // is always 0 → repTalkShare 100% → over-talking would fire permanently.
    const c = computeConfidence({
      recentStress: steadyStress,
      repWords: 100,
      customerWords: 0,
      customerAudible: false,
    });
    expect(c.overTalking).toBe(false);
    expect(c.level).toBe("steady"); // steady stress stays steady
    expect(c.talkShareKnown).toBe(false);
  });

  it("video still reads filler/pace stress (those ARE measurable mic-only)", () => {
    const c = computeConfidence({
      recentStress: [
        { filler: true, pace: true },
        { filler: true, pace: true },
        { filler: false, pace: false },
      ],
      repWords: 100,
      customerWords: 0,
      customerAudible: false,
    });
    expect(c.fillerHigh).toBe(true);
    expect(c.rushing).toBe(true);
    expect(c.level).toBe("unsteady"); // filler+pace both high
  });

  it("defaults customerAudible to true when omitted (in-person)", () => {
    const c = computeConfidence({
      recentStress: steadyStress,
      repWords: 100,
      customerWords: 2,
    });
    expect(c.talkShareKnown).toBe(true);
    expect(c.overTalking).toBe(true);
  });
});
