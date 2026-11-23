# CHECK - Vulnerability disclosure

## Commands

```
npx vitest run src/lib/security src/app/api/security-report src/app/api/admin/security-reports → 11 passed, exit 0
npx tsc --noEmit -p . → exit 0
npm run check → exit 0 · Test Files 862 passed | 1 skipped · Tests 6482 passed | 15 skipped
```

PGlite replay of 0312 (twice, re-runnable), with every role first GRANTED full table privileges:

```
bad report: refused
after update+delete: [ { summary: 'Cross read' } ]      (update and delete ignored)
authenticated: read denied, insert denied
anon: read denied, insert denied
exit 0
```

Production:

```
npm run db:apply → applying 0312_security_reports.sql … ok · DB now at 0312 · ✅ ALL 32 invariants hold
```

## Findings

### F1 - no alert reaches the founders when a report arrives
class: an inbox with no push — a report waits until someone opens the page.
sweep: `grep -rln "export async function sendEmail\|postmark" src/lib` → only src/lib/care/email/outbound.ts (C.A.R.E);
the notification bell lives in the Sales Coach shell.
severity: medium

### F2 - the gates needed reasons for a public, untenanted write path
class: invariant-audit (public mutation route; service-role statement with no tenant) and rls-audit (sealed tables).
sweep: `npm run check` → flagged; allowlisted with why each is safe (public by design; no tenant exists; sealed tables).
severity: low
