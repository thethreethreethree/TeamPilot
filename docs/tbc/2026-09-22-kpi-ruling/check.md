# CHECK

## Commands run

```
      Tests  4916 passed | 15 skipped (4931)
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
| send a rep their rank | CAUGHT |
| send a rep the board size | CAUGHT |
| send a rep the cushion below | CAUGHT *(after F1)* |
| send a rep the whole standing row (spread) | CAUGHT |
| render a rank whenever `managerView` is true | CAUGHT |
| drop the rep's own total headline | CAUGHT |

"Send a rep the whole standing row" is the one worth naming: `{ ...standing, }` is the natural
refactor, it looks tidier than seven named fields, and it puts the rank straight back.

## Findings

### F1 — the fixture put the rep last, where the cushion is null anyway

class: a fixture that cannot exercise the thing it guards. The rep in the default payload was
  bottom of a two-rep board, so `gaps.ahead` was null whether the route withheld it or not. The
  "send a rep the cushion below" mutation survived against a test whose name says it covers exactly
  that.
severity: medium. The withholding was correct; the test proving it was not a test. It is the same
  shape as the milestones build's Century fixture and the bell's failed-read test — three fixtures
  in three builds that could not fail, each found by mutation rather than by reading.
sweep: any assertion that a value is null or absent, where the fixture would produce null anyway.
  The question to ask of each: does the input make the wrong answer POSSIBLE?
fix: a three-rep board with the rep in the middle, so there genuinely is someone 45 points below —
  and the test now also asserts that 45 appears nowhere in the payload.

## What is NOT verified

- **Nothing has been rendered in a browser.** Seventh consecutive build. The standing card changed
  shape today — it leads with a number rather than an ordinal — and nobody has seen either version.
- **The ruling is applied to this route only.** It is a general rule about the two documents; I
  applied it where I had already made calls. Nothing sweeps the rest of the product for other
  places the sheet and the KPI document might disagree.
- **Whether a rep experiences one distance as motivating.** The ruling's reasoning is that a target
  beats a position. That is a claim about people, and nothing here tests it.
