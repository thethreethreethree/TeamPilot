# CLOSURE — Mobile Bearer support for the gamification routes

## What shipped
The four gamification API routes (leaderboard, my-points, notifications, calibration) now accept a **mobile
`Authorization: Bearer` token** as well as the web cookie session — so the native app can reuse them, exactly as the
KPI + session routes already do. Identity widens via `resolveApiAuth(req)`; the RLS reads + the `auth_company_id()`
RPC run through the **caller-scoped** token client (`callerScopedDb(req) ?? createClient()`) so `auth.uid()` resolves
and every existing RLS policy applies unchanged. This closes the "authenticate then get an empty result" trap and
makes the mobile build spec's recommended API path actually true.

## Verification (A38)
typecheck + 14 route tests (12 cookie unchanged + 2 new Bearer-path, incl. a cookie-client-throws guard) + the full
canonical `npm run check`. All in check.md.

## The un-named reliance
- Relies on `callerScopedDb` using the **anon key** (not service-role), so RLS stays the enforcement and a bad token
  fails closed — never a cross-tenant read.
- Relies on notifications-POST + calibration keeping their **explicit** `recipient_id` / `company_id` scoping on the
  admin client (those don't get a caller-scoped client, so the explicit pin is the tenant guard there).
- Relies on `resolveApiAuth` trying the cookie first, so no web behavior changes.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R14",
    "item": "Only my-points has a dedicated Bearer-path test. leaderboard/notifications/calibration use the identical pattern but their Bearer path is covered by inspection + the shared pattern, not a per-route test.",
    "why_skipped": "The pattern is identical and proven; one representative Bearer test + the 12 cookie tests + the shared callerScopedDb pattern give adequate assurance without 4x the mocking.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T15:52:00+08:00",
    "outcome": "OPEN — add per-route Bearer tests if a regression ever appears."
  },
  {
    "id": "GAM-R15",
    "item": "Not smoke-tested against a real mobile device / live Supabase token (no device in this environment).",
    "why_skipped": "Proven by unit tests + the proven pattern; a live token round-trip needs the founder's device post-deploy.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T15:52:00+08:00",
    "outcome": "OPEN — founder smoke-tests one Bearer call from the mobile app after deploy."
  }
]
```
