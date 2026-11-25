# CHECK - Fixes from the second review

## Commands

```
review subagent: 5 commits read; findings 1–6; each re-read here before fixing
npx vitest run src/lib/team src/app/api/team → 84 passed (new: setMemberRole refuses "Lead"; null-role member changes)
npx vitest run src/lib/status src/app/status → 7 passed (new: only the live-tested part says Working)
npx vitest run CoachingInbox + coaching-metrics + kpi routes + kpi lib → 120 passed (new: response-only manager row)
```

## Findings

### F1 - /status claimed "Working" for parts it never tested
class: configuration read as health.
sweep: the four parts; only the database is probed live by /api/health.
severity: medium-high (a public claim)

### F2 - the CSV could set a role the Team page refuses
class: two validators for one decision.
sweep: setMemberRole is now the only role writer and validates itself.
severity: medium

### F3 - a member with no role never got one by CSV
class: null used for two meanings.
sweep: roleFrom is the only nullable flag in the plan.
severity: low

### F4 - KPI labels from the button, not the data; stale responses could land
class: UI state and server state disagreeing; an unguarded async race.
sweep: loadMe is the only period-dependent fetch on the page; loadTeam has no period.
severity: medium

### F5 - a response-time-only manager had no row
class: rows keyed from some of the computed columns only.
sweep: panel ids and CSV people both include responseHours now.
severity: low

### F6 - growth summary didn't name its window
class: same as F4.
sweep: the page's other window-dependent text — the card notes (fixed with F4) and the CSV export (Window column added).
severity: low

## Final

```
npm run check → first: ✗ tbc:artifacts (F6 without a sweep line) → added → exit 0 · Test Files 936 passed | 1 skipped · Tests 6819 passed | 15 skipped
```
