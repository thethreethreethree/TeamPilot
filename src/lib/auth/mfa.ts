/**
 * Multi-factor sign-in — the ONE decision every guard consumes (§2.2: a verdict, never re-derived).
 *
 * The inputs are claims from the SIGNED access token, never the cookie's unsigned user object (which the browser can
 * edit): `app_metadata.mfa` is written only by the service role when a person confirms an authenticator, and `aal` is
 * set by Supabase — "aal2" once this session has passed a code. A person who turned MFA on and whose session has not
 * passed a code yet is held at the code screen (pages) or refused (API).
 */
export type MfaClaims = {
  aal?: string | null;
  app_metadata?: { mfa?: unknown; [k: string]: unknown } | null;
} | null | undefined;

export type MfaVerdict = "ok" | "needs_code";

export function mfaVerdict(claims: MfaClaims): MfaVerdict {
  if (!claims) return "ok"; // no session: the sign-in guard decides, not this
  return claims.app_metadata?.mfa === true && claims.aal !== "aal2" ? "needs_code" : "ok";
}

/** The code screen a held page redirects to. */
export const MFA_VERIFY_PATH = "/login/verify";

/**
 * Paths a session that still owes a code may reach: the code screen and its API, sign-in/out, and the public health
 * check. Everything else — every page and every API route — is behind the code.
 */
export function isMfaExempt(path: string): boolean {
  return (
    path === MFA_VERIFY_PATH ||
    path === "/login" ||
    path === "/sales-coach/login" ||
    path.startsWith("/api/auth/") ||
    path === "/api/me/mfa/verify" ||
    path === "/api/health"
  );
}

/** Where a held request goes: pages to the code screen (returning to where they were), API calls a 401. */
export function mfaHold(path: string, search = ""): { kind: "redirect"; to: string } | { kind: "refuse" } {
  if (path.startsWith("/api/")) return { kind: "refuse" };
  return { kind: "redirect", to: `${MFA_VERIFY_PATH}?next=${encodeURIComponent(path + search)}` };
}

export const MFA_REQUIRED_MESSAGE = "Enter the code from your authenticator app to continue.";

/** Decode a JWT's payload WITHOUT verifying it — only for a token the caller has ALREADY verified (e.g. via getUser). */
export function unverifiedClaims(token: string): MfaClaims {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as MfaClaims;
  } catch {
    return null;
  }
}
