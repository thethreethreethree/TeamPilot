# CHECK

## Commands run

```
      Tests  4931 passed | 15 skipped (4946)
  Missing policies:      0
  Violations:            0
  Unreachable modules:   0
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run invariant:audit` | 0 violations, including INVARIANT 27 |

## The tests were made to earn their place

11 mutations. **All caught.**

**The tablist** (9): mount every panel and hide two · open on Breakdown · every tab in the tab
order · no `aria-selected` · arrow keys do not wrap · focus does not follow selection · milestones
dropped from Progress · panel not tied to its tab · any key navigates.

**The density fix** (2): show the tie rule to everyone · hide it from managers too.

"Mount every panel and hide two" is the one worth naming. It is the shorter implementation, it
looks identical on screen, and it triples the requests.

## Findings

### F1 — a test that could not fail, found by mutation for the fourth build running

class: an assertion made from the state where the wrong answer looks like the right one. "Ignores
  keys that are not navigation" pressed an unhandled key while sitting on the FIRST tab — and the
  mutation it was meant to catch falls through to "select the first tab". Identical outcome.
severity: low in effect, and the reason it is recorded is the rate: this is the fourth fixture in
  four builds that asserted something against an input which made the wrong answer unreachable.
sweep: the question that catches all four — *does this fixture make the wrong answer POSSIBLE?* —
  applied to any assertion of "unchanged", "absent" or "null".
fix: the key is pressed from the Metrics tab, and the test asserts both that Metrics stayed AND
  that Progress did not appear.

## What is NOT verified

- **Nothing has been rendered in a browser.** Eighth consecutive build. The tabs change the rep
  dashboard's whole shape — three stacked boards became three panels — and that is the single
  largest visual change made in this session.
- **The Metrics tab's fit is assumed.** `TodaysMetrics` was built as a full-page Macro view with
  its own Day/Week/Month/All-Time control. I nearly wrote here that it now sits under a second
  period control from the Arena — checked, and it does not: the Arena has none, and Breakdown's is
  on a different panel. So each panel carries exactly one period control and they are never on
  screen together, which is consistent rather than conflicting. What remains assumed is whether a
  full-page view reads correctly inside a panel at all.
- **The density pass was a read of my own markup**, which is what the founder chose over a browser
  check and what I said at the time it could not substitute for. It found one real thing. It cannot
  find a layout problem.
