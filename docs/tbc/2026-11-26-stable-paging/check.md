# CHECK - Stable order for paged reads

## Commands

```
node replay0347.mjs → 0347 columns: [["session_id"]] · rss_hidden_calls_for(C, manager): 1 · (C, rep): 0
npm run db:apply → applying 0347_hidden_calls_for_table.sql … ok · ALL 33 invariants hold
npx vitest run hidePhrases + coverage → 14 passed (the order is asserted)
```

## Findings

### F1 - OFFSET paging over non-unique orders
class: a paged read whose order has ties.
sweep: today's three fixed; older routes (KPI started_at, schedule seq, my-points created_at, door log, finance) listed in OPEN.md.
severity: medium

### F2 - a return-type change outran the deployed code
class: a migration that changes a shape the live code reads.
sweep: pushed immediately after applying; the window fails toward "nothing filtered" in service-role lists (RLS still hides).
severity: medium

## Final

```
npm run check → exit 0 · Test Files 962 passed | 1 skipped · Tests 6944 passed | 15 skipped (rerun with the commit)
```
