import { describe, it, expect } from "vitest";
import {
  BASE_MAX,
  BONUSES,
  BONUS_CAP,
  ELEMENTS,
  MAX_SCORE,
  OBJECTION_ELEMENT_ID,
  SECTIONS,
  VIOLATIONS,
  elementsForSection,
  lowestSection,
  type SectionId,
} from "../rubric";

/**
 * Structural guards on the rubric config.
 *
 * These are the launch checklist's first line — "Section maxes add to 100; bonus capped at 30" —
 * turned into assertions. The guide asks a human to confirm them before shipping; a human confirms
 * once, a test confirms on every commit.
 *
 * They also catch the specific way this file will decay: someone adds or re-weights an element and
 * forgets that the section max, the 100 total and the mockups' reconciliations all depend on it.
 */

describe("rubric structure", () => {
  it("the six sections sum to the 100-point base", () => {
    expect(SECTIONS.reduce((n, s) => n + s.maxPoints, 0)).toBe(BASE_MAX);
    expect(SECTIONS).toHaveLength(6);
  });

  it("every section's elements sum exactly to that section's max", () => {
    // The identity the whole product rests on: if these drift, section bars overflow their track,
    // the Breakdown footer stops reconciling, and "avg base / 100" becomes a lie.
    const expected: Record<SectionId, number> = {
      introduction: 12,
      discovery: 16,
      consulting: 14,
      close: 15,
      transitions: 8,
      delivery: 35,
    };
    for (const section of SECTIONS) {
      const sum = elementsForSection(section.id).reduce((n, e) => n + e.points, 0);
      expect(sum, `${section.id} elements`).toBe(section.maxPoints);
      expect(section.maxPoints).toBe(expected[section.id]);
    }
  });

  it("Delivery minus Objection handling is exactly 27 — the scaling base", () => {
    // The rubric says the other skills are "scored out of 27 and scaled to 35". If that 27 is not
    // arithmetically true, every objection-free pitch is mis-scaled and nobody would notice.
    const delivery = elementsForSection("delivery");
    const exObjection = delivery
      .filter((e) => e.id !== OBJECTION_ELEMENT_ID)
      .reduce((n, e) => n + e.points, 0);
    expect(exObjection).toBe(27);
    expect(delivery.find((e) => e.id === OBJECTION_ELEMENT_ID)?.points).toBe(8);
  });

  it("carries all 13 bonuses and 5 violations, with the cap and max score the rubric states", () => {
    expect(BONUSES).toHaveLength(13);
    expect(VIOLATIONS).toHaveLength(5);
    expect(BONUS_CAP).toBe(30);
    expect(MAX_SCORE).toBe(130); // the rubric screen's "100 + 30 − Viol. = 130 Max score"
  });

  it("every id is unique across elements, bonuses and violations", () => {
    const ids = [...ELEMENTS, ...BONUSES, ...VIOLATIONS].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only the buying-questions bonus repeats, and it stops at +6", () => {
    const repeatable = BONUSES.filter((b) => b.repeatable);
    expect(repeatable.map((b) => b.id)).toEqual(["bonus.buyingQuestions"]);
    expect(repeatable[0]!.points).toBe(2);
    expect(repeatable[0]!.maxTotal).toBe(6);
  });

  it("marks exactly the two audio-inferred bonuses, which are the ones needing a confidence floor", () => {
    // The rubric names inside/backyard and laughs as inferred from ambient audio; those are the
    // two a rep is most likely to dispute, and the only two the threshold may reject.
    expect(BONUSES.filter((b) => b.audioInferred).map((b) => b.id).sort()).toEqual([
      "bonus.inside",
      "bonus.laughs",
    ]);
  });

  it("caps talking-over at −6 and flags rudeness for human review", () => {
    const over = VIOLATIONS.find((v) => v.id === "viol.talkingOver")!;
    expect(over.deduction).toBe(2);
    expect(over.maxTotal).toBe(6);
    const rude = VIOLATIONS.find((v) => v.id === "viol.rude")!;
    expect(rude.deduction).toBe(10);
    expect(rude.flagsForReview).toBe(true);
  });
});

describe("lowestSection — by percentage, not raw points", () => {
  it("picks Close over Transitions on the team averages, as the mockup does", () => {
    // The trap, and the reason this helper exists. Transitions is the lowest ABSOLUTE score here,
    // but the mockup badges Close. 8.6/15 = 57.3% beats 4.7/8 = 58.8% to the bottom.
    const teamAverages: Record<SectionId, number> = {
      introduction: 9.8,
      discovery: 11.5,
      consulting: 8.9,
      close: 8.6,
      transitions: 4.7,
      delivery: 23.9,
    };
    expect(lowestSection(teamAverages)).toBe("close");

    // A naive implementation would pick this instead — asserted so the difference is on the record.
    const byRawPoints = (Object.entries(teamAverages) as [SectionId, number][]).sort(
      (a, b) => a[1] - b[1]
    )[0]![0];
    expect(byRawPoints).toBe("transitions");
    expect(byRawPoints).not.toBe(lowestSection(teamAverages));
  });

  it("matches the rep breakdown board (Close, flagged LOWEST)", () => {
    expect(
      lowestSection({
        introduction: 9.8,
        discovery: 11.2,
        consulting: 10.1,
        close: 8.4,
        transitions: 4.6,
        delivery: 24.8,
      })
    ).toBe("close");
  });

  it("matches Humza Khan's panel (Introduction), whose raw-lowest is a different section", () => {
    const humza: Record<SectionId, number> = {
      introduction: 6.2,
      discovery: 11.5,
      consulting: 8.4,
      close: 8.7,
      transitions: 4.8,
      delivery: 22.4,
    };
    // The reps table reads "LOWEST SECTION: Introduction" for him — 6.2/12 = 51.7%.
    expect(lowestSection(humza)).toBe("introduction");
    // His raw lowest is Transitions at 4.8, so this dataset independently rules out the naive rule.
    expect(humza.transitions).toBeLessThan(humza.introduction);
  });
});
