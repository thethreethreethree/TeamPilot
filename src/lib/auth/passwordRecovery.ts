/**
 * Shared helpers for the password-recovery REQUEST side (`/auth/forgot`).
 *
 * Why this exists
 * ───────────────
 * The recovery COMPLETION page (`/auth/recover`) already existed — it consumes the emailed token and lets the
 * user set a new password. What was missing was any way to REQUEST that email. This module holds the small,
 * pure pieces the request page needs, and — critically — the SINGLE source of truth for the completion route,
 * so the request side and the completion side can never drift onto different paths.
 */

/** The route that completes a recovery (the set-new-password form). Keep in sync with the folder that renders
 *  it: `src/app/auth/recover/page.tsx`. `passwordRecovery.test.ts` asserts that page exists on disk. */
export const RECOVER_PATH = "/auth/recover";

/**
 * Build the absolute URL the recovery email should return the user to, from the current browser origin.
 * Supabase requires this to be an allow-listed redirect (Authentication → URL Configuration → Redirect URLs).
 */
export function recoverRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${RECOVER_PATH}`;
}

/**
 * The confirmation shown after a reset request. Deliberately NEUTRAL: it must not reveal whether an account
 * exists for the given email (account enumeration is a dishonest signal handed to an attacker — §3.4). Supabase's
 * `resetPasswordForEmail` already returns success regardless of existence; this message matches that posture.
 */
export const RECOVERY_REQUESTED_MESSAGE =
  "If an account exists for that email, a password-reset link is on its way. Check your inbox (and spam).";

/**
 * Minimal client-side email sanity check so we don't fire a request on obvious garbage. Supabase performs the
 * authoritative validation; this is just to keep the button honest and give instant feedback.
 */
export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 320) return false; // 320 = RFC 5321 max
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
