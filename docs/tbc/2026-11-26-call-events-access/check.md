# CHECK - A call's AI reads follow the call's access

## Commands

```
node replay0348.mjs → before: every viewer reads sales_session,task · after: rep sales_session,task | peer rep task | rep's manager sales_session,task | other manager task | admin sales_session,task
node eventsCost0348.mjs (production, one transaction, ROLLED BACK) → manager call events 126ms → 139ms (1,330 rows); all events 114ms; a rep: call events 0 rows (was company-wide), all events 1,623 rows
npm run db:apply → applying 0348_call_events_follow_call_access.sql … ok · ALL 33 invariants hold
npx vitest run hideCoverage → 5 passed
```

## Findings

### F1 - anyone in the company could read any call's AI reads
class: a company-wide read rule on a table that stores call content.
sweep: both call subject forms (sales_session:, pitch:) now follow their table's rule; other subjects unchanged.
severity: high

## Final

```
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6947 passed | 15 skipped
```
