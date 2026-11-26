import { describe, it, expect } from "vitest";
import { isMfaExempt, mfaHold, mfaVerdict, unverifiedClaims } from "../mfa";

/** Multi-factor sign-in (2026-11-23): the one verdict the middleware, resolveApiAuth and extensionAuth all consume. */
describe("mfaVerdict", () => {
  it("holds a session whose signed token says MFA is on and has not passed a code", () => {
    expect(mfaVerdict({ aal: "aal1", app_metadata: { mfa: true } })).toBe("needs_code");
    expect(mfaVerdict({ app_metadata: { mfa: true } })).toBe("needs_code");
  });
  it("lets through a session that passed its code, and anyone without MFA", () => {
    expect(mfaVerdict({ aal: "aal2", app_metadata: { mfa: true } })).toBe("ok");
    expect(mfaVerdict({ aal: "aal1", app_metadata: {} })).toBe("ok");
    expect(mfaVerdict({ aal: "aal1", app_metadata: { mfa: false } })).toBe("ok");
    expect(mfaVerdict({ aal: "aal1", app_metadata: { mfa: "true" } })).toBe("ok"); // only the boolean the service role writes
  });
  it("no session is not this guard's decision", () => {
    expect(mfaVerdict(null)).toBe("ok");
    expect(mfaVerdict(undefined)).toBe("ok");
  });
});

describe("what a held session can still reach", () => {
  it("the code screen, its API, sign-in and the health check", () => {
    for (const p of ["/login/verify", "/login", "/sales-coach/login", "/api/auth/sign-in", "/api/me/mfa/verify", "/api/health"]) expect(isMfaExempt(p)).toBe(true);
  });
  it("nothing else — including enrolling or removing an authenticator", () => {
    for (const p of ["/dashboard", "/api/coach/remote/prospects", "/api/me/mfa", "/api/team/mfa-reset", "/api/me/mfa/verify/x"]) expect(isMfaExempt(p)).toBe(false);
  });
  it("pages go to the code screen and come back; API calls are refused", () => {
    expect(mfaHold("/dashboard/remote-sales/today", "?x=1")).toEqual({ kind: "redirect", to: "/login/verify?next=%2Fdashboard%2Fremote-sales%2Ftoday%3Fx%3D1" });
    expect(mfaHold("/api/coach/remote/day")).toEqual({ kind: "refuse" });
  });
});

describe("unverifiedClaims", () => {
  const tok = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
  it("reads aal and app_metadata from a (already verified) token, padding-safe", () => {
    expect(unverifiedClaims(tok({ aal: "aal1", app_metadata: { mfa: true } }))).toEqual({ aal: "aal1", app_metadata: { mfa: true } });
    expect(unverifiedClaims(tok({ a: 1 }))).toEqual({ a: 1 });
  });
  it("garbage is null — which the verdict reads as 'no session', leaving the route's own auth to refuse", () => {
    expect(unverifiedClaims("not-a-jwt")).toBeNull();
    expect(unverifiedClaims("a.@@@.b")).toBeNull();
  });
});

describe("the extension's connect page (2026-11-27)", () => {
  it("is held for the code like any page, keeping the extension's id to return to", () => {
    expect(isMfaExempt("/extension/connect")).toBe(false);
    expect(mfaHold("/extension/connect", "?ext=abc")).toEqual({ kind: "redirect", to: `/login/verify?next=${encodeURIComponent("/extension/connect?ext=abc")}` });
  });
});

