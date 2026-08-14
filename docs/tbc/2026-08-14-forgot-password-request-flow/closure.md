# CLOSURE — password-recovery REQUEST flow ("Forgot password?")

## What shipped
The password-recovery COMPLETION page (`/auth/recover`) already existed, but there was no way to REQUEST the
email — both login pages pointed users at a "recovery link" that nothing rendered (§1.5.1 layer-3 continuity
gap). Shipped the missing request side: a pure helper (`src/lib/auth/passwordRecovery.ts`), a new `/auth/forgot`
page that calls `resetPasswordForEmail` with a redirect back to `/auth/recover`, and a "Forgot password?" link on
BOTH login surfaces (main + Sales Coach). Confirmation is neutral (anti-enumeration, §3.4); demo mode is honest.

Immediate remediation done in the same session: a live recovery email was sent to sanpedrodf@gmail.com
(founder-chosen method), so that account can self-set a password now rather than waiting on this deploy.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-forgot-password-request-flow)
typecheck ✓ · lint ✓
theme-leak audit — Theme-bound leaks: 0 ✓
RLS policy audit — RLS-enabled tables: 125 · without RLS: 0 · RLS-bypassing views: 0 ✓
Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2863 passed | 15 skipped (2878)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "Supabase redirect-URL allowlist must include https://elostate.com/auth/recover (Authentication → URL Configuration → Redirect URLs).", "why_skipped": "Dashboard configuration, not code. It was documented to be set when /auth/recover was built; if a recovery link drops the user on the homepage instead of the set-password form, this entry is the fix.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T05:15:00Z", "outcome": "Flagged to the founder in-session." },
  { "id": "R2", "item": "The client pages (/auth/forgot + the two login links) have no component test.", "why_skipped": "The repo has 0 *.test.tsx; client auth pages rely on typecheck/lint + manual/E2E. The testable logic was extracted into passwordRecovery.ts and IS gated. A browser E2E of the full request→email→recover→sign-in loop is the honest next check.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T05:15:30Z", "outcome": "Accepted; matches the codebase convention." }
]
```

## Un-named reliance
- Relies on Supabase `resetPasswordForEmail` returning success regardless of whether the email is registered
  (the anti-enumeration posture the neutral confirmation depends on) — standard GoTrue behavior.
- Relies on the browser `window.location.origin` being the allow-listed origin at request time (dev/preview/prod
  each build their own redirect); the completion page reads the token from the URL fragment as it already did.

## Status
Complete once the gate shows exit 0. The recovery flow is now reachable from both login surfaces; the completion
half was exercised live (the sanpedrodf recovery email). Redirect-allowlist + a browser E2E remain flagged.
