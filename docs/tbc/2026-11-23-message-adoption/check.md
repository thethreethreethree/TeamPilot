# CHECK - Message adoption on trackers

## Commands

```
npx vitest run adoption.test.ts + trackers/[id]/adoption route → 7 passed, exit 0
npm run check → first: ✗ americanSpelling ("analysed" in TrackerAdoption.tsx) → fixed → exit 0 · Tests 6542 passed | 15 skipped
```

## Findings

### F1 - a capped read of hits could undercount adoption
class: one read of up to 1000 rows where a call can have many hits.
sweep: `grep -n "fetchAllPagedResult" "src/app/api/coach/remote/trackers/[id]/adoption/route.ts"` → sessions, stats and
hits are all paged (fixed before commit).
severity: medium

### F2 - no adoption goal per message
class: Gong's high/low adoption goals (F18.3) are not modeled.
sweep: `grep -rn "goal" src/lib/coach/remote/adoption.ts` → none.
severity: low
