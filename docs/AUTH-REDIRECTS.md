# Auth redirects — the external-config contract

**Status: load-bearing.** Several auth flows are only *operationally* complete when Supabase dashboard config
matches the code. The code cannot enforce this — it is an **external precondition that must be VERIFIED, not
assumed** (CLAUDE.md §1.5.3 / ThinkerThinker A41). This file is the contract; the 2026-08-14 password-recovery
outage happened because it did not exist.

## What broke (so it doesn't again)
A user's "Reset your password" link opened the **marketing project** (`…-iota.vercel.app`) instead of the
set-new-password form. The recovery *code* was correct on both ends. Root cause: Supabase only honors a
`redirectTo` that is in its **Redirect URLs allowlist**; anything else **silently falls back to the Site URL** —
which was pointed at the marketing project. Compounded by the reset link using `window.location.origin` (which
varied by which of the two Vercel projects the user started from).

## The code side (already done — the invariant)
Every auth email-redirect is built from **one canonical origin** (`siteUrl()` → `NEXT_PUBLIC_SITE_URL`), never
the browser origin, via the single source `src/lib/auth/passwordRecovery.ts`:
- `canonicalRecoverUrl()` → `<siteUrl>/auth/recover` — used by `/auth/forgot`.
- `signupConfirmRedirectUrl()` → `<siteUrl>/login` — passed as `emailRedirectTo` by every `signUp` (login,
  invite, redeem).

Because these take **no origin argument**, a request from any preview/marketing domain still targets the ONE
canonical URL. That collapses the config surface to a small, fixed allowlist (locked by `passwordRecovery.test.ts`).

## The config side — REQUIRED, verify before trusting recovery/signup
Supabase Dashboard → **Authentication → URL Configuration**:

| Setting | Required value | Failure if wrong |
|---|---|---|
| **Site URL** | `https://elostate.com` (the app — NOT the `…-iota.vercel.app` marketing project) | Reset + signup-confirm links land on whatever the Site URL is (the outage) |
| **Redirect URLs** | must include `https://elostate.com/auth/recover`, `https://elostate.com/login`, and `https://elostate.com/**` | Supabase ignores `redirectTo`/`emailRedirectTo` → falls back to Site URL |

Also confirm `NEXT_PUBLIC_SITE_URL=https://elostate.com` is set on the **app** Vercel project (so `siteUrl()`
resolves to the canonical origin, not the production fallback). Check via `/api/health` `deploymentUrl` — the two
Vercel projects are the `reference_multiple_vercel_projects_env_drift` trap.

## Verification procedure (the "it actually works" check — §1.5.1)
Do NOT mark recovery "done" on a green build alone. Verify end-to-end against the live config:
1. From `https://elostate.com/auth/forgot`, request a reset for a test account.
2. Open the email → the link host must be `elostate.com` and the path `/auth/recover` (NOT the marketing root).
3. The page must render the **set-new-password** form, accept a new password, and let you sign in with it.
4. (Signup) Sign up a throwaway account → the confirmation link must land on `elostate.com`, not the marketing page.

If step 2 lands anywhere but `/auth/recover`, the **Redirect URLs allowlist / Site URL is wrong** — fix the
config, not the code.

## The rule this encodes
A feature whose correctness depends on config **outside the repo** (dashboard settings, allowlists, DNS, env,
webhook secrets) is not operationally complete until that config is either (a) verified working end-to-end, or
(b) documented here as a blocking setup step with its required values and a verification procedure. "The code is
correct and it builds" is not "it works" when an external precondition is unmet.
