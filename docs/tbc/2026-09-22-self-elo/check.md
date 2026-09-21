# CHECK

## Commands run

```
      Tests  4951 passed | 15 skipped (4966)
  Violations:            0
  Unreachable modules:   0
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| the three suites | 13 + 29 + route passed |

## The tests were made to earn their place

15 mutations. **All caught.**

**The verdict** (9): no understanding gate · gate only the baseline · off by one on the threshold ·
an element with no baseline counts as improvement · no floor on a tiny move · no rounding ·
nothing-rose reported as insufficient · pick the smallest gain · an element graded zero times still
counts.

**The surface** (6): hide the insufficient state · render insufficient as "nothing improved" · drop
the reason · improvement below the strength · show only the delta · hide no_change.

The two worth naming are **"nothing-rose reported as insufficient"** and **"hide the insufficient
state"**. They are the same mistake from opposite ends — one tells a rep the system could not tell
when it could, the other tells them an answer when it could not — and both look like a working
board.

## no findings

Nothing was discovered that needed fixing after it was built. The rounding floor was set from the
case found in an earlier build (`100.1 - 100` is `0.09999999999999432`) rather than rediscovered,
and there is a test for exactly that pair.

## Limits of this check

- **No real comparison has run.** Every test drives the verdict through fixtures; no baseline has
  been read from a real `pitch_scores` table.
- **The threshold of three is a judgement.** It is defensible — below it one pitch dominates — and
  it is not in the rubric and nobody has approved it.
- **Nothing has been rendered in a browser.** Eleventh consecutive build. The Breakdown now opens
  with up to three stacked callouts (improved, strongest, opportunity), which is exactly the
  density question a density pass cannot answer.
- **The second read doubles this route's database work.** It is two bounded reads rather than one,
  and nothing has measured the latency on a real period.
