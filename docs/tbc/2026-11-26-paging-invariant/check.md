# CHECK - Every paged read ordered by a unique key

## Commands

```
node pagingScan.mjs → 42 paged reads without a unique last order → after the fix: 13, each unique by its own key (allowlisted)
node hasId.mjs (replayed schema) → every source has id except fin_overhead_allocation, fin_overhead_unallocated, fin_cash_flow_summary, rep_kpi_daily (ordered by their key columns)
npm run invariant:audit → Violations: 0; with one new order removed (kpi/me) → Violations: 1 naming that file; restored → 0
npm run check → first ✗ 18 tests in 10 schedule files (their mocks allowed one .order() only) → mocks accept a second → 388 passed (schedule) → rerun below
```

## Findings

### F1 - paged reads could repeat or skip rows
class: OFFSET paging over a non-unique order.
sweep: all 42 found; 29 given an id tiebreaker, 13 unique by their key and listed.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 962 passed | 1 skipped · Tests 6944 passed | 15 skipped
```
