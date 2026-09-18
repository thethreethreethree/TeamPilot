import { describe, it, expect } from "vitest";
import { generateTempPassword } from "../tempPassword";
import { validateStrongPassword } from "../passwordPolicy";

/**
 * The generator's contract is the SHARED policy, not a regex copied into this file — if the two ever disagree,
 * an admin hands out a password that the login form or /set-password then refuses, and the member is stuck
 * holding a string that looks right.
 *
 * The readability rules are load-bearing too, not cosmetic: this password's delivery channel is a human reading
 * it down a phone or retyping it from a text message, so an O/0 or I/l/1 collision produces the second support
 * call this whole feature exists to prevent.
 */
describe("generateTempPassword", () => {
  it("always satisfies the shared password policy", () => {
    for (let i = 0; i < 500; i++) {
      const pw = generateTempPassword();
      expect(validateStrongPassword(pw), `failed policy: ${pw}`).toEqual({ ok: true, error: "" });
    }
  });

  it("never contains a glyph that is misread aloud or retyped", () => {
    // O/0, I/l/1 — the pairs that turn a correct password into a failed login.
    for (let i = 0; i < 500; i++) {
      expect(generateTempPassword()).not.toMatch(/[O0Il1]/);
    }
  });

  it("does not put the required character classes in fixed positions", () => {
    // Without the shuffle every password is Upper-lower-digit-special-then-random, which leaks structure and
    // makes the first four characters guessable in shape. Assert the special char is NOT always at one index.
    const positions = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      positions.add(pw.split("").findIndex((c) => /[^A-Za-z0-9]/.test(c)));
    }
    expect(positions.size).toBeGreaterThan(3);
  });

  it("honours the requested length and defaults to 14", () => {
    expect(generateTempPassword()).toHaveLength(14);
    expect(generateTempPassword(20)).toHaveLength(20);
    expect(generateTempPassword(8)).toHaveLength(8);
  });

  it("refuses a length below the policy floor rather than emitting a weak password", () => {
    expect(() => generateTempPassword(7)).toThrow(/at least 8/i);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTempPassword()));
    expect(seen.size).toBe(500);
  });
});
