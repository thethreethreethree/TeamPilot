import { describe, it, expect } from "vitest";
import {
  PILOT_CODE_ALPHABET,
  PILOT_CODE_LENGTH,
  isValidPilotCodeShape,
  generatePilotCode,
  generateDistinctPilotCodes,
} from "../generateCode";

/**
 * The load-bearing guard (§ convert-verification-to-structural-guard): the
 * alphabet must contain NO look-alike glyphs. The live 100 codes were verified
 * typo-safe once; this test makes it impossible to regress the *method* — a
 * future edit adding 0/O/1/I/L fails CI here, not in a client's support ticket.
 */
describe("PILOT_CODE_ALPHABET typo-safety", () => {
  it("excludes every ambiguous glyph (0 O 1 I L)", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      expect(PILOT_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("has no duplicate characters", () => {
    expect(new Set(PILOT_CODE_ALPHABET).size).toBe(PILOT_CODE_ALPHABET.length);
  });

  it("is drawn only from A–Z and 2–9", () => {
    expect(PILOT_CODE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
  });
});

describe("isValidPilotCodeShape", () => {
  it("accepts a well-formed code", () => {
    expect(isValidPilotCodeShape("ABCD23K")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidPilotCodeShape("ABC23")).toBe(false);
    expect(isValidPilotCodeShape("ABCDEFGH")).toBe(false);
  });
  it("rejects a code containing an ambiguous / out-of-alphabet char", () => {
    expect(isValidPilotCodeShape("ABCDE0K")).toBe(false); // 0 not in alphabet
    expect(isValidPilotCodeShape("ABCDEIK")).toBe(false); // I not in alphabet
    expect(isValidPilotCodeShape("abcd23k")).toBe(false); // lowercase not in alphabet
  });
  it("rejects non-strings", () => {
    // @ts-expect-error deliberately wrong type
    expect(isValidPilotCodeShape(null)).toBe(false);
    // @ts-expect-error deliberately wrong type
    expect(isValidPilotCodeShape(1234567)).toBe(false);
  });
});

describe("generatePilotCode", () => {
  it("produces a shape-valid code for any in-range random source", () => {
    // deterministic cycling source — every index reachable
    let n = 0;
    const cyclic = (max: number) => n++ % max;
    for (let i = 0; i < 200; i++) {
      const code = generatePilotCode(cyclic);
      expect(code.length).toBe(PILOT_CODE_LENGTH);
      expect(isValidPilotCodeShape(code)).toBe(true);
    }
  });

  it("only ever emits alphabet characters (never an ambiguous glyph)", () => {
    let n = 3;
    const src = (max: number) => (n = (n * 7 + 13) % 1000) % max; // pseudo-varied, no Math.random
    for (let i = 0; i < 500; i++) {
      for (const ch of generatePilotCode(src)) {
        expect(PILOT_CODE_ALPHABET).toContain(ch);
      }
    }
  });
});

describe("generateDistinctPilotCodes", () => {
  it("returns the requested count, all distinct", () => {
    let n = 1;
    const src = (max: number) => (n = (n * 1103515245 + 12345) & 0x7fffffff) % max;
    const codes = generateDistinctPilotCodes(50, src);
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
  });

  it("never collides with the provided `existing` set", () => {
    let n = 1;
    const src = (max: number) => (n = (n * 1103515245 + 12345) & 0x7fffffff) % max;
    const first = generateDistinctPilotCodes(20, src);
    const second = generateDistinctPilotCodes(20, src, first);
    for (const c of second) expect(first).not.toContain(c);
  });

  it("throws rather than looping forever when the space is exhausted", () => {
    // A degenerate constant source can only ever produce ONE code, so asking for
    // 2 distinct must terminate with an error, not hang.
    const constant = () => 0;
    expect(() => generateDistinctPilotCodes(2, constant)).toThrow(/distinct/);
  });
});
