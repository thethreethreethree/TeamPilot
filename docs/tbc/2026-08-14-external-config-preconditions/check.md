# CHECK — canonical auth redirects + AMD-011

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — reset/confirm links used `window.location.origin` → drifted onto an un-allowlisted domain → Supabase fell back to the Site URL (marketing project)
file+line: `src/app/auth/forgot/page.tsx` (`recoverRedirectUrl(window.location.origin)`) + 3 `signUp` sites with
no `emailRedirectTo`.
class: **external-config completeness (§1.5.3 / A41)** — correct code, dead end-to-end because an external
precondition (Supabase Redirect-URLs allowlist / Site URL) went unchecked and the target origin drifted.
severity: CRITICAL — locked-out users can't recover; new users' confirm links also misland.
sweep-command: `grep -rn "window.location.origin\|emailRedirectTo\|resetPasswordForEmail\|signUp(" src/app src/lib`
— all auth email-redirects now build from `siteUrl()` via the two canonical helpers.
read-path: fixed — one canonical URL to allow-list; drift impossible.

## Class sweep (A26 / the audit)
`docs/CONFIG-PRECONDITIONS-AUDIT.md`. Auth-redirect surface CLOSED (only recovery + signup). Remaining
silent-config surfaces (VAPID push, care-email) flagged for the founder as health-visibility follow-ups. The
fail-LOUD pattern (cron 503s) is the model to copy.

## Constitutional (§7)
AMD-011 ratified; §1.5.3 + checklist 5c + A41 added; constitution.ts bumped (INVARIANT 12 satisfied).

## Tests
```
$ npx vitest run passwordRecovery
 Test Files  1 passed (1)
 Tests  12 passed (12)
```
Full gate + exit code in closure.md.
