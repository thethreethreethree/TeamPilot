import { describe, expect, it } from "vitest";
import { validateCounts, deriveGrade, type CoachCounts } from "../grader";

const counts = (
  pos: [number, number, number],
  risks: [number, number, number] = [0, 0, 0]
): CoachCounts => ({
  positive: { acknowledged: pos[0] as 0 | 1, answered: pos[1] as 0 | 1, next_step: pos[2] as 0 | 1 },
  risks: {
    unsupported_absolutes: risks[0],
    fabricated_specifics: risks[1],
    empty_filler: risks[2],
  },
  reason_internal: "",
});

/**
 * The C.A.R.E grade is DERIVED from countable signals (§3.5), and the counts are
 * sanitized before they're trusted. These pin both.
 */
describe("deriveGrade — grade derived from countables (§3.5)", () => {
  it("3 positives + 0 risks → productive", () => {
    expect(deriveGrade(counts([1, 1, 1]))).toBe("productive");
  });
  it("2 positives + 0 risks → neutral", () => {
    expect(deriveGrade(counts([1, 1, 0]))).toBe("neutral");
  });
  it("<2 positives → needs_guidance", () => {
    expect(deriveGrade(counts([1, 0, 0]))).toBe("needs_guidance");
  });
  it("ANY risk forces needs_guidance, even with 3 positives", () => {
    expect(deriveGrade(counts([1, 1, 1], [0, 1, 0]))).toBe("needs_guidance");
  });
});

describe("validateCounts — sanitize before trusting the model's self-report", () => {
  it("collapses each positive to 0/1 (a claimed 5 is still just 'present')", () => {
    const c = validateCounts({ positive: { acknowledged: 5, answered: 1, next_step: 0 }, risks: {} });
    expect(c!.positive.acknowledged).toBe(1);
    expect(c!.positive.answered).toBe(1);
    expect(c!.positive.next_step).toBe(0);
  });

  it("floors risks to non-negative ints (negative / NaN → 0)", () => {
    const c = validateCounts({
      positive: {},
      risks: { unsupported_absolutes: -3, fabricated_specifics: 2.9, empty_filler: "x" },
    });
    expect(c!.risks.unsupported_absolutes).toBe(0);
    expect(c!.risks.fabricated_specifics).toBe(2);
    expect(c!.risks.empty_filler).toBe(0);
  });

  it("caps reason_internal at 600 chars", () => {
    const c = validateCounts({ positive: {}, risks: {}, reason_internal: "z".repeat(1000) });
    expect(c!.reason_internal.length).toBe(600);
  });

  it("returns null when positive or risks blocks are missing", () => {
    expect(validateCounts({ positive: {} })).toBeNull();
    expect(validateCounts({ risks: {} })).toBeNull();
    expect(validateCounts(null)).toBeNull();
    expect(validateCounts(42)).toBeNull();
  });
});
