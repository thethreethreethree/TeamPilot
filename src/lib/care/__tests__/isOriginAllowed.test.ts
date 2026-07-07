import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "../config";

/**
 * The widget origin allowlist — the security invariant that keeps a tenant's
 * support widget from being embedded on unauthorized domains. Pinned: an exact
 * match is always required; the "*" wildcard is honored ONLY in non-production —
 * in PRODUCTION there is no wildcard escape (the property a regression would break).
 */
describe("isOriginAllowed", () => {
  const allowed = ["https://acme.com", "https://app.acme.com"];

  it("admits an exact allowlisted origin", () => {
    expect(isOriginAllowed({ origin: "https://acme.com", allowedOrigins: allowed, isProduction: true })).toBe(true);
  });

  it("rejects a non-allowlisted origin (exact match — no substring bypass)", () => {
    for (const origin of ["https://evil.com", "https://acme.com.evil.com", "https://acme.co", "", "acme.com"])
      expect(isOriginAllowed({ origin, allowedOrigins: allowed, isProduction: true })).toBe(false);
  });

  it("in PRODUCTION the wildcard does NOT grant access (no wildcard escape)", () => {
    expect(isOriginAllowed({ origin: "https://anything.com", allowedOrigins: ["*"], isProduction: true })).toBe(false);
  });

  it("in NON-production the wildcard grants access (pilot/dev convenience)", () => {
    expect(isOriginAllowed({ origin: "https://anything.com", allowedOrigins: ["*"], isProduction: false })).toBe(true);
  });

  it("an exact match still wins even with a wildcard present, in prod", () => {
    expect(
      isOriginAllowed({ origin: "https://acme.com", allowedOrigins: ["*", "https://acme.com"], isProduction: true })
    ).toBe(true);
  });

  it("empty allowlist rejects everything", () => {
    expect(isOriginAllowed({ origin: "https://acme.com", allowedOrigins: [], isProduction: false })).toBe(false);
  });
});
