import { describe, it, expect } from "vitest";
import { validateStrongPassword, isStrongPassword } from "../passwordPolicy";

describe("validateStrongPassword (team password policy)", () => {
  it("accepts a password with 8+ chars incl. upper, lower, digit, special", () => {
    expect(validateStrongPassword("Team@2026")).toEqual({ ok: true, error: "" });
    expect(isStrongPassword("Aa1!aaaa")).toBe(true);
  });
  it("rejects and reports the FIRST failing rule", () => {
    expect(validateStrongPassword("short1!").error).toContain("at least 8"); // too short (7)
    expect(validateStrongPassword("ALLUPPER1!").error).toContain("lowercase");
    expect(validateStrongPassword("alllower1!").error).toContain("uppercase");
    expect(validateStrongPassword("NoDigits!!").error).toContain("number");
    expect(validateStrongPassword("NoSpecial1").error).toContain("special");
  });
  it("is case-sensitive in class detection and rejects empty/whitespace", () => {
    expect(isStrongPassword("")).toBe(false);
    expect(isStrongPassword("        ")).toBe(false); // whitespace has no letter/digit/special
    expect(isStrongPassword("Abcdefg1!")).toBe(true);
  });
  it("rejects an over-long password", () => {
    expect(validateStrongPassword("Aa1!" + "x".repeat(300)).error).toContain("too long");
  });
});
