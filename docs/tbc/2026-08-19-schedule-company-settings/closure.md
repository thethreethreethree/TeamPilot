# Company schedule settings — Closure

## What shipped
Timezone + workweek-start are now company settings (migration 0224). One guarded reader
(`getScheduleSettings`) + a `todayInTz` helper (Intl, no dependency) feed the correctness-critical consumers:
the server "today" (current/upcoming time-off filter, coverage-gap cutoff), the weekly-hours-cap week + the
fair-load ranking (via `ctx.weekStartDay`), and the grid's default week + columns. A Settings tab + page lets
a manager set both (manager-only PATCH, IANA-validated, company_id pinned — INV15). Defaults are UTC/Monday,
so a company that sets nothing behaves exactly as before.

## Verification (A38)
Migration applied to the live DB:
```
npm run db:apply
[db-apply] 1 pending migration(s): 0224_companies_schedule_settings.sql
✅ ALL 27 invariants hold.
[db-apply] ✓ verify:live passed.
EXIT: 0
```
Detection-proof: reverting weekStartOf's `weekStartDay` param → the workweek-start test FAILS; restored →
31/31 pass. Canonical gate:
```
npm run check   →   typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
EXIT: 0
```

## Residuals (ranked; A36 — top must be opened)
```json
[
  { "id": "R1", "item": "The companies UPDATE RLS lets any company member (not only admins) update the row; the admin restriction is route-only.", "why_skipped": "This is the established pattern (0201 default_theme, 0095 policy): companies UPDATE is company-scoped in RLS, and the admin gate is enforced at each route. The schedule Settings PATCH adds ctx.isAdmin, consistent with every other companies-settings write.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-19T23:20:00Z", "outcome": "OPENED + confirmed: read 0095 (company - update: using/with check id = auth_company_id()) and 0201 (default_theme admin-set via Settings, gated by the same RLS). The PATCH route enforces isAdmin; RLS scopes to the caller's company. Consistent with precedent; no cross-tenant or privilege gap." },
  { "id": "R2", "item": "weekStartDay is threaded into the time-off EVALUATE context, but a time_off change doesn't hit the hours-cap (only assign/swap do).", "why_skipped": "Passing it is harmless + future-proof (an assign evaluated through that context would use it); leaving it out would be an inconsistency to trip over later.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R3", "item": "The client grid recomputes today via Intl in the browser; a very old browser lacking Intl.supportedValuesOf gets a UTC/zone-list fallback.", "why_skipped": "Guarded (optional chaining + try/catch → ['UTC'] / UTC slice); the app already targets modern evergreen browsers.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R4", "item": "The coverage-side overnight window nuance (evalContext.overlaps clamps at 24:00) is still not tz-aware.", "why_skipped": "That is the separate RQ4 overnight-coverage item, tangled with cross-date semantics; this build adds the tz SETTING but not the overnight-window rework, which is its own change.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```
