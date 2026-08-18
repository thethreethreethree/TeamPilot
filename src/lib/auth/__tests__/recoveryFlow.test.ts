import { describe, it, expect } from "vitest";
import { detectRecoveryFlow } from "../recoveryFlow";

/**
 * Guard for the password-recovery HIGH fix (audit 2026-08-19). The page must accept all three link shapes a
 * PKCE-configured Supabase client can produce, an explicit error, a mis-typed link, and the no-credential case.
 * The Supabase calls themselves need a live test; this locks the DECISION so the "handles all formats" behavior
 * can't silently regress to hash-only (the state that made recovery dead).
 */
describe("detectRecoveryFlow", () => {
  it("implicit fragment (#access_token & #refresh_token) → setSession path", () => {
    const f = detectRecoveryFlow("#access_token=AAA&refresh_token=BBB&type=recovery", "");
    expect(f).toEqual({ kind: "implicit", accessToken: "AAA", refreshToken: "BBB" });
  });

  it("PKCE (?code=) → exchangeCodeForSession path", () => {
    const f = detectRecoveryFlow("", "?code=authcode123");
    expect(f).toEqual({ kind: "pkce", code: "authcode123" });
  });

  it("verifyOtp (?token_hash=&type=recovery) → verifyOtp path", () => {
    const f = detectRecoveryFlow("", "?token_hash=hash_abc&type=recovery");
    expect(f).toEqual({ kind: "otp", tokenHash: "hash_abc" });
  });

  it("an explicit error in the query takes precedence over any credential", () => {
    const f = detectRecoveryFlow("#access_token=AAA&refresh_token=BBB", "?error=access_denied&error_description=Link+expired");
    expect(f.kind).toBe("error");
    expect(f).toMatchObject({ message: "Link expired" });
  });

  it("an error in the fragment is also honored", () => {
    const f = detectRecoveryFlow("#error_code=otp_expired", "");
    expect(f.kind).toBe("error");
  });

  it("a non-recovery type (e.g. signup) is rejected explicitly, not treated as recovery", () => {
    const f = detectRecoveryFlow("#access_token=AAA&refresh_token=BBB&type=signup", "");
    expect(f.kind).toBe("error");
    expect(f).toMatchObject({ message: expect.stringContaining("type=signup") });
  });

  it("no credential at all → missing (the page shows 'request a new recovery email')", () => {
    expect(detectRecoveryFlow("", "")).toEqual({ kind: "missing" });
    expect(detectRecoveryFlow("#", "?")).toEqual({ kind: "missing" });
  });

  it("implicit wins over pkce when both are somehow present (historical order preserved)", () => {
    const f = detectRecoveryFlow("#access_token=AAA&refresh_token=BBB", "?code=xyz");
    expect(f.kind).toBe("implicit");
  });
});
