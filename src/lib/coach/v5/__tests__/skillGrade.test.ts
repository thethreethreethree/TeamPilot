import { describe, it, expect } from "vitest";
import { gradeSkill, type LetterGrade } from "../skillGrade";

/**
 * ELOSALES Standard revision — pins the /10 → letter-grade mapping (decision ①(b)).
 * The constitutional properties that must hold regardless of band tuning:
 *  - A11: the letter always travels with its countable basis (fromScore).
 *  - A18: there is NO "F" — the floor is "D" / growth-area, a coaching target, not a penalty verdict.
 *  - §3.5/§3.6: null (no data) → an honest not-yet, NEVER a low letter.
 */

describe("gradeSkill — /10 → letter (ELOSALES Standard)", () => {
  it("§3.5 HONEST-EMPTY: null/undefined/NaN score → not-yet, NOT a low grade", () => {
    for (const s of [null, undefined, NaN]) {
      const g = gradeSkill(s as number | null | undefined);
      expect(g.letter).toBeNull();
      expect(g.tier).toBe("not-yet");
      expect(g.fromScore).toBeNull();
    }
  });

  it("A11: the letter always carries the /10 it summarizes (a count, not a bare verdict)", () => {
    const g = gradeSkill(7.8);
    expect(g.letter).toBe("B");
    expect(g.fromScore).toBe(7.8); // the countable basis travels with the grade
  });

  it("maps the band boundaries (inclusive lower bound, highest match wins)", () => {
    const cases: Array<[number, LetterGrade]> = [
      [10, "A+"], [9.5, "A+"], [9.0, "A"], [8.5, "A-"], [8.0, "B+"],
      [7.0, "B"], [6.5, "B-"], [6.0, "C+"], [5.5, "C"], [5.0, "C-"], [4.9, "D"], [0, "D"],
    ];
    for (const [score, letter] of cases) {
      expect(gradeSkill(score).letter).toBe(letter);
    }
  });

  it("A18: NO score anywhere in [0,10] produces an 'F' — the floor is D / growth-area (invites coaching)", () => {
    for (let s = 0; s <= 10; s += 0.1) {
      const g = gradeSkill(s);
      expect(g.letter).not.toBe("F"); // by construction there is no F
      expect(g.letter).not.toBeNull(); // a real score always grades
    }
    expect(gradeSkill(0).tier).toBe("growth-area"); // the lowest is a coaching target, not a verdict
  });

  it("tiers track the existing /10 UI semantics (strong ≥8 / developing ≥5 / growth-area <5)", () => {
    expect(gradeSkill(9).tier).toBe("strong");
    expect(gradeSkill(7).tier).toBe("solid");
    expect(gradeSkill(5.2).tier).toBe("developing");
    expect(gradeSkill(3).tier).toBe("growth-area");
  });

  it("clamps out-of-range inputs to [0,10] rather than throwing", () => {
    expect(gradeSkill(99).letter).toBe("A+");
    expect(gradeSkill(-5).letter).toBe("D");
  });
});
