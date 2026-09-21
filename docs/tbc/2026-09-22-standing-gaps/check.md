# CHECK

## Commands run

```
      Tests  4913 passed | 15 skipped (4928)
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

## The tests were made to earn their place

8 mutations. **All caught.**

| Mutation | |
|---|---|
| gap to the LEADER instead of the rep above | CAUGHT |
| null for a tie instead of zero | CAUGHT |
| no rounding | CAUGHT *(after F1)* |
| behind and ahead swapped | CAUGHT |
| a rep off the board gets zeros | CAUGHT |
| hide the gaps entirely | CAUGHT |
| treat a tie as nobody (truthiness) | CAUGHT |
| render behind even when null | CAUGHT |

## Findings

### F1 — the rounding comment named an example that does not misbehave

class: a justification asserted rather than checked. The comment said totals "can produce
  61.99999999999999" from `80.3 - 18.4`. That subtraction is EXACTLY 61.9. The test built on the
  same example, so the rounding mutation survived — the fixture could not tell rounded from
  unrounded.
severity: medium. The rounding is right and was right for a reason I had not verified. Had the
  survivor been waved off as an equivalent mutant, the code would have kept a correct line with a
  false explanation and a test that proved nothing.
sweep: any numeric-rounding comment that names a specific float. `node -e` on the literal pair is
  the whole check.
fix: searched for pairs that actually break at realistic magnitudes — `100.1 - 100` is
  `0.09999999999999432` — and found the real case is a NEAR-TIE, which is also where a rep reads
  the number hardest. Comment and fixture both now say that.

### F2 — the "Metrics" tab has no page in the sheet

class: a nav label mistaken for a specified surface. My own status page listed "Today's Metrics
  board" as remaining work. The sheet's sub-nav does show a third tab — Progress | Breakdown |
  **Metrics** — but has **four content pages** and none of them is it. "Today's Metrics" in the
  bottom nav is a different, already-built section (`TodaysMetricsPager`, the 2026-09-04 Macro
  spec).
severity: medium as a planning error, high had it been built. This is the same shape as the
  milestone definitions one build earlier: I would have invented the contents of a board from the
  word on its tab, and it would have looked plausible.
sweep: `pdftotext -layout` the sheet and compare its PAGES against what a summary lists as
  surfaces. Four pages: Progress, Breakdown, Pitch detail, How points work.
fix: not built. Recorded as needing the founder, rather than filled in from a label.

## What is NOT verified

- **Nothing has been rendered in a browser.** Sixth consecutive build.
- **The sheet's exact wording is not used.** It says "62 pts behind #1"; this says "behind the rep
  above", because naming the rank would reveal the position of another person. That is my
  substitution and the founder may want the rank shown.
- **No end-to-end run.** The gaps have never been computed from real pitches.
