# CHECK — KPI compute-cron agent-enumeration truncation

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the agent-enumeration read truncated at 1000 rows, silently dropping agents from the KPI run
file+line: `coach/kpi/compute-cron/route.ts` — the `.select("company_id, agent_id").limit(5000)` enumeration.
class: unbounded/false-limit truncation (the sweep's class) applied to an ENUMERATION read — worse than an
undercount, it means whole agents get no KPI snapshot. Bites past 1000 sessions, even with <100 agents.
severity: medium as a bug, but LOW live-impact — the cron is DORMANT (no CRON_SECRET). Fixed proactively so it's
correct the day it goes live.
sweep-command: `grep -rnE "\.limit\(\s*[0-9]{4,}\s*\)" src/app/api/coach/kpi` — after the fix, compute-cron has no
false limit; the me/team routes were already paged (build xo); the trajectory route uses no >1000 limit.
remediation: page the enumeration via fetchAllPaged (see remediate.md).

## Tests
```
$ npx vitest run src/app/api/coach/kpi/compute-cron
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
The mock was re-keyed from the removed `.limit()` to the enumeration read's `company_id` select column; the
enumerate→load→compute path still asserts 12 inserts for the batched agent. The >1000-row paging boundary is
covered by src/lib/supabase/__tests__/paginate.test.ts.

## Full gate
```
PENDING — pasted in closure after the run
```
