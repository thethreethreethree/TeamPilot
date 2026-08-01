# CHECK — module hard-lock enforcement (Phase 5b/5c)

## Audit
- RPC recreate is faithful: statement-by-statement the 0207 body matches 0197 (insert companies / insert
  profiles / update companies ai_guidance / care_tenant_config plan / sales_coach_role / update pilot_codes /
  return) with ONE isolated addition (access_module stamp). A copy error here would break provisioning, so it
  was diffed before applying.
- Column is member-readable (0001 companies SELECT) and pilot_codes is RLS-sealed (verify:live confirms), so
  the column is the correct home for the signal — not a member-unreadable pilot_codes read.
- Middleware fails OPEN (A30): a lookup error never locks a legitimate user out.

## Findings (A26)
No findings. Verified both module paths don't loop: sales_coach (has sales_coach_role → passes the
sales-coach layout gate) and care (/dashboard/care has no access gate → accessible); the nested embed returns
`companies` as an object (not an array), so the lock resolves; redeem→land lands on the module home (allowed).

## Verification
```
$ npm run db:apply          → applied 0207; DB at 0207
$ npm run verify:live       → ALL 22 invariants hold
$ backfill spot-check       → companies: 13 null (full) / 1 sales_coach ; redeemed codes: 1 sales_coach (match)
$ npx tsc --noEmit          → tsc_exit=0
$ vitest moduleAccess       → 13 passed
```
Full `npm run check` is the CI gate.
