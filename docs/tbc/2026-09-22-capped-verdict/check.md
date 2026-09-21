# CHECK

## Commands run

```
      Tests  4900 passed | 15 skipped (4915)
  Missing policies:      0
  Violations:            0
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |

## The tests were made to earn their place

6 mutations. **All caught.**

| Mutation | |
|---|---|
| never report the cap | CAUGHT |
| count mapped pitches instead of rows | CAUGHT |
| off by one on the bound (`>` for `>=`) | CAUGHT |
| an empty read claims capped | CAUGHT |
| hide the truncation notice | CAUGHT |
| always show the truncation notice | CAUGHT |

"Count mapped pitches instead of rows" is the one worth naming: it is the more natural line to
write, it is what the discarded version did, and it is wrong only when a pitch is skipped — which
is exactly when a caller most needs the answer.

## no findings

Nothing new was discovered. The defect this build fixes was already recorded as a finding-shaped
residual in two earlier closures; it is fixed here rather than re-reported.

## What is NOT verified

- **The cap has never actually bitten.** Every test drives it through a mock or a small limit. No
  read of a real table has returned 900 rows.
- **Nothing has been rendered in a browser**, including the new notice.
- **The breakdown route ignores `capped`.** It reads a period for one rep and could truncate for a
  very busy rep in a long window; it neither reports nor surfaces the flag. Named, not fixed.
