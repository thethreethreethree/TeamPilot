# CHECK - Failed reads shown as "none" (the null form)

## Commands

```
npx vitest run src/lib/__tests__/noFailedReadAsEmpty.test.ts → first run with the null form: 1 failed — src/app/dashboard/page.tsx 1,
  remote-sales/search/page.tsx 3, sales-coach/analytics/page.tsx 1, sales-coach/roleplay/page.tsx 2 (allowed 0)
after fixes → 4 passed, exit 0
npm run check → exit 0 · Test Files 864 passed | 1 skipped · Tests 6504 passed | 15 skipped
```

## Findings

### F1 - the first sweep covered src/components only
class: a sweep whose scope is narrower than the class.
sweep: `grep -rn "r.ok ? r.json() : null)" src/app` → 7 more, found by the guard's first run; 6 fixed, 1 (analytics) already
turns null into an error and is allowlisted with that reason.
severity: medium

### F2 - RepArena's leaderboard read still maps a failure to null
class: label read (rank) under a data read that now fails loud.
sweep: `grep -n "leaderboard?period=all" src/components/sales-coach/RepArena.tsx` → one; allowlisted (count 1).
severity: low
