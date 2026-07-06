import { describe, expect, it } from "vitest";
import { sanitizeOrIlikeTerm } from "../searchTerm";

describe("sanitizeOrIlikeTerm — PostgREST .or() filter-injection guard", () => {
  it("strips the comma that breaks OUT of an ilike into an injected condition", () => {
    // The core exploit: a comma ends the ilike condition and starts a new one.
    expect(sanitizeOrIlikeTerm("x,id.gt.0")).toBe("x id.gt.0");
    // No comma survives to split the .or() string.
    expect(sanitizeOrIlikeTerm("x,id.gt.0")).not.toContain(",");
  });

  it("strips parentheses (grouping / in-list injection)", () => {
    expect(sanitizeOrIlikeTerm("a(b)c")).toBe("a b c");
    expect(sanitizeOrIlikeTerm("foo)or(bar")).not.toMatch(/[()]/);
  });

  it("preserves ilike wildcards and ordinary search text", () => {
    // % and _ are ilike wildcards the callers rely on; ordinary chars are inert.
    expect(sanitizeOrIlikeTerm("annual report 2026")).toBe("annual report 2026");
    expect(sanitizeOrIlikeTerm("50%_off")).toBe("50%_off");
    expect(sanitizeOrIlikeTerm("user@example.com")).toBe("user@example.com");
  });

  it("trims so a fully-metachar term doesn't become a padded blank", () => {
    expect(sanitizeOrIlikeTerm("(),")).toBe("");
  });

  it("is idempotent", () => {
    const once = sanitizeOrIlikeTerm("a,(b)");
    expect(sanitizeOrIlikeTerm(once)).toBe(once);
  });
});
