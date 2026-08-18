# CHECK — Macro Mode (checkpoint)

## Verification run (A38)
Canonical command: `npm run check`. Full output + exit code in closure.md. DB migrations checked by
`npm run db:apply` (which auto-runs verify:live) + `npm run rls:audit`.

## Findings (caught + fixed this build)

### F1 — rep_kpi_daily view bypassed RLS (would leak every company's KPIs)
class: **RLS-bypass view** — a plain view runs as its owner, so RLS on the base table never applies to the querying user.
severity: high — cross-tenant read of every company's KPI aggregates.
sweep-command: `npm run rls:audit` (view scan) + `npm run verify:live` (behavioural non-invoker-view check).
read-path: fixed → `security_invoker = true` (`0216` set it; `0217` restated with the canonical literal the static auditor matches).
write-path: verify:live's non-invoker-view check + rls:audit's view scan now both pass (RLS-bypass views = 0).

### F2 — pitches UPDATE policy didn't pin company_id (rep could move a pitch cross-tenant)
class: **tenant-pin gap on write (INV15)** — an UPDATE `with check` that doesn't re-assert company_id lets a row move tenants.
severity: medium — a rep could UPDATE their own pitch and set company_id to another tenant.
sweep-command: `npm run rls:audit` (tenant-pin risks must be 0).
read-path: fixed (`0218`) → `with check (rep_id = auth.uid() and company_id = auth_company_id())`.
write-path: rls:audit tenant-pin risks = 0.

Both were MY migration bugs, caught by the repo's own guards before deploy — the guards worked.

## Tests
```
$ npx vitest run src/lib/coach/doorlog
 Test Files  5 passed (5)
 Tests  18 passed (18)
```
`npm run rls:audit` → 0 tenant-pin risks · 0 missing policies · 0 RLS-bypass views.
`verify:live` → ALL 26 invariants hold. Full gate + exit code in closure.md.
