# CHECK - Alert the founders to waiting security reports

## Commands

```
npx vitest run src/app/api/admin/security-reports → 7 passed (waiting: counts unanswered, founders only, failed read = 500)
npx vitest run SecurityWaitingBadge.render.test.tsx → 2 passed (count shown; nothing at zero; nothing on a failed read)
npm run check (first) → ✗ invariant:audit: .limit(5000) is a false bound (PostgREST caps at 1000) and two service-role reads name no tenant → both reads paged (fetchAllPagedResult); the no-tenant reads allowlisted with the 0312 reason → invariant:audit Violations: 0
```

## Findings

### F2 - the first version capped the event read at a limit PostgREST silently lowers to 1000
class: a capped read under a count — an undercount reads as fewer waiting (or a false "all clear").
sweep: the gate found it; both reads of this route now page every row.
severity: medium

### F1 - the badge updates on navigation, not the moment a status is recorded
class: a count derived on one screen, changed on another.
sweep: the only writer of security_report_events is the inbox PUT; after it, the next navigation re-reads the count.
severity: low

## Final

```
npm run check → exit 0 · Test Files 893 passed | 1 skipped · Tests 6610 passed | 15 skipped
```
