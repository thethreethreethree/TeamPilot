import { describe, it, expect } from "vitest";
import { scorePitch, type GradedElement } from "../scorePitch";
import { ELEMENTS, SECTIONS, elementsForSection, type SectionId } from "../rubric";

/**
 * The scoring formula: `total = max(0, base + min(bonus, 30) − violations)`.
 *
 * Three of these tests exist because the arithmetic has an obvious wrong version that produces a
 * plausible number: capping the bonus after averaging, subtracting violations before the bonus,
 * and flooring a component instead of the total. Each is asserted against its correct value AND,
 * where it helps, against what the wrong version would have produced.
 *
 * The last block reproduces the mockups' own numbers. The guide's launch checklist demands the
 * reconciliations hold; the sample data already satisfies them, which makes it a usable oracle.
 */

/** Grade every element of a section the same way — keeps the fixtures readable. */
function gradeSection(section: SectionId, grade: GradedElement["grade"]): GradedElement[] {
  return elementsForSection(section).map((e) => ({ elementId: e.id, grade }));
}

const allHit = (): GradedElement[] => ELEMENTS.map((e) => ({ elementId: e.id, grade: "hit" }));

const clean = {
  objectionOccurred: true,
  reachedDiscovery: true,
} as const;

describe("base score", () => {
  it("a perfect pitch scores 100 base, and each section sits at its max", () => {
    const r = scorePitch({ elements: allHit(), ...clean });
    expect(r.base).toBe(100);
    for (const s of SECTIONS) expect(r.sectionPoints[s.id]).toBe(s.maxPoints);
  });

  it("gives half credit for a Partial and nothing for a Missed", () => {
    const r = scorePitch({
      elements: [
        { elementId: "close.qualification", grade: "hit" }, // 3
        { elementId: "close.deposit", grade: "partial" }, // 1.5
        { elementId: "close.simple", grade: "missed" }, // 0
      ],
      ...clean,
    });
    expect(r.sectionPoints.close).toBe(4.5);
    expect(r.base).toBe(4.5);
  });

  it("scores an unreached element as zero rather than skipping it", () => {
    // "Score every element reached; unreached elements score 0." A short pitch is a low score,
    // not an incomplete one, which is what lets the 40-base rule do the filtering.
    const r = scorePitch({ elements: gradeSection("introduction", "hit"), ...clean });
    expect(r.sectionPoints.introduction).toBe(12);
    expect(r.sectionPoints.delivery).toBe(0);
    expect(r.base).toBe(12);
  });

  it("ignores an element id the current rubric no longer knows", () => {
    // A version bump can retire an element; a stored grade pointing at it must not make an old
    // pitch unscoreable.
    const r = scorePitch({
      elements: [{ elementId: "intro.trucks", grade: "hit" }, { elementId: "retired.thing", grade: "hit" }],
      ...clean,
    });
    expect(r.base).toBe(3);
  });
});

describe("Delivery scaling when no objection occurs", () => {
  it("scales the other five skills from 27 up to 35", () => {
    const r = scorePitch({
      elements: gradeSection("delivery", "hit"),
      objectionOccurred: false,
      reachedDiscovery: true,
    });
    // All five non-objection skills hit = 27 raw, scaled to the full 35.
    expect(r.sectionPoints.delivery).toBe(35);
    expect(r.deliveryScaled).toBe(true);
  });

  it("does not credit Objection handling when no objection happened", () => {
    // "A smooth pitch is not penalized, and avoiding objections earns no free points." Half the
    // five skills hit should land near half of 35, not at 35 minus something.
    const r = scorePitch({
      elements: [
        { elementId: "deliv.talkListen", grade: "hit" }, // 7
        { elementId: "deliv.tone", grade: "hit" }, // 7
        { elementId: "deliv.questionQuality", grade: "missed" },
        { elementId: "deliv.spokenYes", grade: "missed" },
        { elementId: "deliv.pace", grade: "missed" },
      ],
      objectionOccurred: false,
      reachedDiscovery: true,
    });
    expect(r.sectionPoints.delivery).toBe(18.1); // 14/27 × 35 = 18.148…
  });

  it("does NOT scale when an objection did occur", () => {
    const r = scorePitch({ elements: gradeSection("delivery", "hit"), ...clean });
    expect(r.sectionPoints.delivery).toBe(35);
    expect(r.deliveryScaled).toBe(false);
  });

  it("keeps sections summing to base even when Delivery was scaled", () => {
    // The launch-checklist identity. An unscaled 27-max Delivery would silently break it on every
    // objection-free pitch, and the Breakdown footer would stop adding up.
    const r = scorePitch({
      elements: allHit().filter((e) => e.elementId !== "deliv.objectionHandling"),
      objectionOccurred: false,
      reachedDiscovery: true,
    });
    const summed = SECTIONS.reduce((n, s) => n + r.sectionPoints[s.id], 0);
    expect(Math.round(summed * 10) / 10).toBe(r.base);
    expect(r.base).toBe(100);
  });
});

describe("bonuses", () => {
  it("awards a one-off bonus once even if detected twice", () => {
    const r = scorePitch({
      elements: [],
      bonuses: [{ bonusId: "bonus.directv" }, { bonusId: "bonus.directv" }],
      ...clean,
    });
    expect(r.bonus).toBe(5);
  });

  it("stacks buying questions at +2 each and stops at +6", () => {
    const r = scorePitch({
      elements: [],
      bonuses: Array.from({ length: 5 }, () => ({ bonusId: "bonus.buyingQuestions" })),
      ...clean,
    });
    expect(r.bonus).toBe(6); // not 10
  });

  it("caps the whole bonus pool at 30 per pitch", () => {
    const r = scorePitch({
      elements: [],
      bonuses: [
        { bonusId: "bonus.inside", confidence: 0.99 }, // 5
        { bonusId: "bonus.directv" }, // 5
        { bonusId: "bonus.wireless" }, // 5
        { bonusId: "bonus.adt" }, // 5
        { bonusId: "bonus.referral" }, // 5
        { bonusId: "bonus.nonDecisionMakerSave" }, // 4
        { bonusId: "bonus.icebreaker" }, // 3  → 32 raw
      ],
      ...clean,
    });
    expect(r.bonus).toBe(30);
  });

  it("rejects an audio-inferred bonus below the confidence floor, and records it", () => {
    const r = scorePitch({
      elements: [],
      bonuses: [{ bonusId: "bonus.inside", confidence: 0.6 }],
      ...clean,
    });
    expect(r.bonus).toBe(0);
    // Recorded rather than dropped silently — a rep disputing "I did get inside" needs the system
    // to be able to say it saw it and was not sure enough.
    expect(r.rejectedLowConfidence).toEqual(["bonus.inside"]);
  });

  it("awards it once confidence clears the floor, and honours a custom threshold", () => {
    expect(
      scorePitch({ elements: [], bonuses: [{ bonusId: "bonus.inside", confidence: 0.92 }], ...clean }).bonus
    ).toBe(5);
    expect(
      scorePitch({
        elements: [],
        bonuses: [{ bonusId: "bonus.inside", confidence: 0.6 }],
        audioConfidenceThreshold: 0.5,
        ...clean,
      }).bonus
    ).toBe(5);
  });

  it("does not apply a confidence floor to bonuses detected from the words", () => {
    // Only inside/backyard and laughs are audio-inferred; a spoken DIRECTV pitch carries no
    // confidence and must not be silently rejected for lacking one.
    expect(scorePitch({ elements: [], bonuses: [{ bonusId: "bonus.directv" }], ...clean }).bonus).toBe(5);
  });
});

describe("violations", () => {
  it("caps talking-over at −6 however many times it happened", () => {
    const r = scorePitch({
      elements: [],
      violations: Array.from({ length: 6 }, () => ({ violationId: "viol.talkingOver" })),
      ...clean,
    });
    expect(r.violations).toBe(6); // not 12
  });

  it("counts a one-off violation once", () => {
    const r = scorePitch({
      elements: [],
      violations: [{ violationId: "viol.rude" }, { violationId: "viol.rude" }],
      ...clean,
    });
    expect(r.violations).toBe(10);
  });

  it("leaves the violation TOTAL uncapped — only individual ones have ceilings", () => {
    const r = scorePitch({
      elements: [],
      violations: [
        { violationId: "viol.rude" }, // 10
        { violationId: "viol.talkingTooMuch" }, // 5
        { violationId: "viol.notEnoughQuestions" }, // 5
      ],
      ...clean,
    });
    expect(r.violations).toBe(20);
  });
});

describe("the total, and the three ways to get it wrong", () => {
  it("subtracts violations AFTER adding the bonus", () => {
    const r = scorePitch({
      elements: gradeSection("introduction", "hit"), // base 12
      bonuses: [{ bonusId: "bonus.directv" }], // +5
      violations: [{ violationId: "viol.talkingTooMuch" }], // −5
      ...clean,
    });
    expect(r.total).toBe(12);
    expect(r.base).toBe(12);
    expect(r.bonus).toBe(5);
    expect(r.violations).toBe(5);
  });

  it("floors the TOTAL at zero, not any single component", () => {
    const r = scorePitch({
      elements: gradeSection("introduction", "missed"),
      violations: [{ violationId: "viol.rude" }, { violationId: "viol.talkingTooMuch" }],
      ...clean,
    });
    expect(r.total).toBe(0);
    // The parts stay truthful; only the leaderboard figure is floored.
    expect(r.violations).toBe(15);
    expect(r.base).toBe(0);
  });

  it("caps the bonus FIRST, then subtracts violations — the only case where the order shows", () => {
    // This is the discriminating case, and it was missing. With bonus under the cap, or with no
    // violations, `base + min(bonus,30) − v` and `base + min(bonus − v, 30)` agree, so every other
    // test here passes under either ordering — a mutation folding violations inside the cap went
    // green across all 35 tests. It only diverges when the bonus EXCEEDS the cap and there is also
    // a deduction: the wrong order lets a violation be absorbed by the discarded bonus overflow,
    // so a rep who talked over the customer pays nothing for it.
    const r = scorePitch({
      elements: gradeSection("introduction", "hit"), // base 12
      bonuses: [
        { bonusId: "bonus.inside", confidence: 1 }, // 5
        { bonusId: "bonus.directv" }, // 5
        { bonusId: "bonus.wireless" }, // 5
        { bonusId: "bonus.adt" }, // 5
        { bonusId: "bonus.referral" }, // 5
        { bonusId: "bonus.nonDecisionMakerSave" }, // 4
        { bonusId: "bonus.icebreaker" }, // 3
        { bonusId: "bonus.laughs", confidence: 1 }, // 3
        { bonusId: "bonus.pullsUpBill" }, // 3  → 38 raw, capped to 30
      ],
      violations: [{ violationId: "viol.talkingTooMuch" }], // −5
      ...clean,
    });
    expect(r.bonus).toBe(30);
    expect(r.violations).toBe(5);
    expect(r.total).toBe(37); // 12 + 30 − 5. Folding the violation inside the cap would give 42.
  });

  it("caps the bonus before it reaches the total, so a 40-bonus pitch scores like a 30 one", () => {
    const many = [
      { bonusId: "bonus.inside", confidence: 1 },
      { bonusId: "bonus.directv" },
      { bonusId: "bonus.wireless" },
      { bonusId: "bonus.adt" },
      { bonusId: "bonus.referral" },
      { bonusId: "bonus.nonDecisionMakerSave" },
      { bonusId: "bonus.icebreaker" },
      { bonusId: "bonus.laughs", confidence: 1 },
      { bonusId: "bonus.pullsUpBill" },
    ]; // 38 raw
    const r = scorePitch({ elements: allHit(), bonuses: many, ...clean });
    expect(r.bonus).toBe(30);
    expect(r.total).toBe(130); // the stated ceiling, not 138
  });
});

describe("qualification", () => {
  it("does not qualify when Discovery was never reached, whatever the score", () => {
    const r = scorePitch({ elements: allHit(), objectionOccurred: true, reachedDiscovery: false });
    expect(r.qualifying).toBe(false);
    expect(r.notQualifyingReason).toBe("Didn't reach Discovery");
  });

  it("does not qualify under 40 BASE even when bonuses lift the total above it", () => {
    // The trap the recordings list walks into: a healthy-looking total next to "Not counted".
    const r = scorePitch({
      elements: gradeSection("introduction", "hit"), // base 12
      bonuses: [
        { bonusId: "bonus.directv" },
        { bonusId: "bonus.wireless" },
        { bonusId: "bonus.adt" },
        { bonusId: "bonus.referral" },
        { bonusId: "bonus.nonDecisionMakerSave" },
        { bonusId: "bonus.icebreaker" },
        { bonusId: "bonus.pullsUpBill" },
      ], // +30 capped
      ...clean,
    });
    expect(r.total).toBe(42); // reads like a qualifying score
    expect(r.base).toBe(12); // but the rule looks here
    expect(r.qualifying).toBe(false);
    expect(r.notQualifyingReason).toBe("Scored under 40 base");
  });

  it("qualifies at exactly 40 base with Discovery reached", () => {
    const r = scorePitch({
      elements: [
        ...gradeSection("introduction", "hit"), // 12
        ...gradeSection("discovery", "hit"), // 16
        ...gradeSection("consulting", "hit"), // 14 → 42
      ],
      ...clean,
    });
    expect(r.base).toBeGreaterThanOrEqual(40);
    expect(r.qualifying).toBe(true);
    expect(r.notQualifyingReason).toBeNull();
  });
});

describe("reproduces the mockups' published numbers", () => {
  it("the Pitch detail board: 86.5 base + 22 bonus − 2 = 106.5", () => {
    // Section totals read off page 3: 12 / 14 / 13 / 13.5 / 6 / 28.
    const r = scorePitch({
      elements: [
        ...gradeSection("introduction", "hit"), // 12 / 12
        // Discovery 14 / 16 — two points short, one Partial on the 4-point speed test.
        { elementId: "disc.usage", grade: "hit" },
        { elementId: "disc.currentSpeeds", grade: "hit" },
        { elementId: "disc.speedTest", grade: "partial" },
        { elementId: "disc.currentBill", grade: "hit" },
        { elementId: "disc.painAmplifier", grade: "hit" },
        // Consulting 13 / 14 — one 1-pointer missed.
        { elementId: "cons.sharedVsDedicated", grade: "hit" },
        { elementId: "cons.hotButtons", grade: "hit" },
        { elementId: "cons.checklistSpeed", grade: "hit" },
        { elementId: "cons.checklistPrice", grade: "hit" },
        { elementId: "cons.checklistEquipment", grade: "hit" },
        { elementId: "cons.checklistInstall", grade: "missed" },
        // Close 13.5 / 15 — the board shows Options close as PARTIAL 1.5.
        { elementId: "close.qualification", grade: "hit" },
        { elementId: "close.deposit", grade: "hit" },
        { elementId: "close.simple", grade: "hit" },
        { elementId: "close.options", grade: "partial" },
        { elementId: "close.paperwork", grade: "hit" },
        // Transitions 6 / 8.
        { elementId: "trans.introToDiscovery", grade: "hit" },
        { elementId: "trans.discoveryToConsulting", grade: "hit" },
        { elementId: "trans.consultingToClose", grade: "hit" },
        { elementId: "trans.closeToQualify", grade: "missed" },
        // Delivery 28 / 35 — exactly 7 points short.
        { elementId: "deliv.objectionHandling", grade: "hit" }, // 8
        { elementId: "deliv.talkListen", grade: "hit" }, // 7
        { elementId: "deliv.tone", grade: "hit" }, // 7
        { elementId: "deliv.questionQuality", grade: "missed" }, // 0  (−5)
        { elementId: "deliv.spokenYes", grade: "partial" }, // 2  (−2)
        { elementId: "deliv.pace", grade: "hit" }, // 4  → 28
      ],
      // The board's seven bonuses: icebreaker +3, laughs +3, inside +5, pain in own words +2,
      // two buying questions +2 each, DIRECTV +5 = 22.
      bonuses: [
        { bonusId: "bonus.icebreaker" },
        { bonusId: "bonus.laughs", confidence: 0.95 },
        { bonusId: "bonus.inside", confidence: 0.92 }, // the board states "92% confidence"
        { bonusId: "bonus.painOwnWords" },
        { bonusId: "bonus.buyingQuestions" },
        { bonusId: "bonus.buyingQuestions" },
        { bonusId: "bonus.directv" },
      ],
      violations: [{ violationId: "viol.talkingOver" }], // −2
      ...clean,
    });

    expect(r.sectionPoints.introduction).toBe(12);
    expect(r.sectionPoints.discovery).toBe(14);
    expect(r.sectionPoints.consulting).toBe(13);
    expect(r.sectionPoints.close).toBe(13.5);
    expect(r.sectionPoints.transitions).toBe(6);
    expect(r.sectionPoints.delivery).toBe(28);
    expect(r.bonus).toBe(22);
    expect(r.violations).toBe(2);
    expect(r.qualifying).toBe(true);

    // The two figures the board actually prints. These are asserted against LITERALS on purpose:
    // an earlier version of this test checked `summed === base` and
    // `total === base + bonus − violations`, which are tautologies the scorer satisfies no matter
    // what it computes — the fixture was producing 87.0 / 107.0 and the test was green.
    expect(r.base).toBe(86.5);
    expect(r.total).toBe(106.5);

    // And the launch-checklist identity on top, now that the inputs are pinned.
    const summed = SECTIONS.reduce((n, s) => n + r.sectionPoints[s.id], 0);
    expect(Math.round(summed * 10) / 10).toBe(86.5);
  });
});
