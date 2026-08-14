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

import { siteUrl } from "@/lib/siteUrl";

/** The route that completes a recovery (the set-new-password form). Keep in sync with the folder that renders
 *  it: `src/app/auth/recover/page.tsx`. `passwordRecovery.test.ts` asserts that page exists on disk. */
export const RECOVER_PATH = "/auth/recover";

/**
 * Build the absolute URL the recovery email should return the user to, from a given origin (pure — for tests).
 * Supabase requires this to be an allow-listed redirect (Authentication → URL Configuration → Redirect URLs).
 */
export function recoverRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${RECOVER_PATH}`;
}

/**
 * CANONICAL recovery-completion URL — the ONE URL every reset email must return to, built from the app's
 * configured origin (`siteUrl()`), NEVER the browser origin.
 *
 * Why this is the only correct entry point (2026-08-14 incident): a user can start recovery from a preview
 * deployment or the marketing project. If the reset link uses `window.location.origin`, its target varies by
 * where the user was — and Supabase only honors a `redirectTo` that is in the Redirect-URLs allowlist; anything
 * else silently falls back to the **Site URL** (the marketing page). Pinning to `siteUrl()` means there is exactly
 * ONE URL to allowlist (`<siteUrl>/auth/recover`) and it can never drift onto an un-allowlisted origin. This
 * function depends on an EXTERNAL config precondition — see docs/AUTH-REDIRECTS.md — which must be VERIFIED, not
 * assumed (CLAUDE.md §1.5.3 / A41).
 */
export function canonicalRecoverUrl(): string {
  return recoverRedirectUrl(siteUrl());
}

/**
 * CANONICAL signup-confirmation return URL. Passed as `emailRedirectTo` on every `signUp` so a confirmation link
 * lands on the app (sign-in), never Supabase's Site-URL default (which, mis-set, is the marketing project). Same
 * allowlist precondition as `canonicalRecoverUrl` — `<siteUrl>/login` must be allow-listed.
 */
export function signupConfirmRedirectUrl(): string {
  return `${siteUrl()}/login`;
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
