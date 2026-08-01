# CLOSURE — module hard-lock enforcement (Phase 5b/5c)

## What shipped
The module hard-lock is functional + live-migrated: a single-module pilot account (companies.access_module =
care|sales_coach) is confined to its module subtree by the middleware — landing there and being redirected
home from any other /dashboard route. Complete/legacy accounts (null) are unaffected. The signal is set at
redemption (RPC) + backfilled for existing accounts.

## Un-named reliance (not self-evident)
- The care_tenant_config lever that resolveUserLanding uses is UNRELIABLE (0045 auto-creates it for every
  company) — verified against the live DB, which is why the reliable `access_module` column exists.
- The middleware nested select `profiles.select("companies(access_module)")` returns the to-one company as an
  object; read defensively + fail-open.
- Landing is handled by the SAME redirect: a locked user on the hub is sent to their module home, so no
  separate login-landing change is needed for locked accounts.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The SalesCoachShell 'Back to ELOSTATE' link (→ /dashboard) is a redirect no-op loop for a locked sales_coach account; should be hidden for locked accounts.", "why_skipped": "Harmless (middleware bounces them back); a nav-gating polish follow-up.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T12:30:00Z", "outcome": "OPENED — hide for locked accounts next." },
  { "id": "RES-02", "item": "No middleware integration test (edge middleware is hard to unit-test); the pure decision core IS tested (13 cases).", "why_skipped": "redirectForLock carries the logic + is tested; middleware is thin glue.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T12:30:00Z", "outcome": "OPENED." },
  { "id": "RES-03", "item": "The middleware adds ONE DB query per /dashboard navigation for authed users.", "why_skipped": "Acceptable for a hard-lock; a nested single query alongside the existing getUser. Optimize (JWT claim) only if latency shows.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T12:30:00Z", "outcome": "OPENED." }
]
```

## Verification
db:apply ok (DB 0207); verify:live 22/22; tsc exit 0; moduleAccess 13/13 (see check.md).
