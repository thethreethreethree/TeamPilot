# BUILD

## Files

**`src/lib/coach/pitchScore/aggregate.ts`** — `countPresentations` corrected.

| | Before | After |
|---|---|---|
| default source | `recorded_pitches` | `doors_spoken_to` |
| status in the docblock | "OPEN DECISION — the build guide's own #1, unresolved" | settled 2026-09-11, with the reversal and the numbers |
| alternative | `rep_log` | `recorded_pitches` — the thing that was reversed |

`computeActivityKpis` takes `doorsSpokenTo` and keeps `recordedPitches` optional, so the reverted
definition stays one argument away rather than a rewrite. The founder has changed this once on
evidence and may again.

**`docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md`** — B3 rewritten from *"Open
decision #1, not applied"* to **"NOT OPEN. SETTLED 2026-09-11."**, with the reversal, the two
measurements, and what the old entry got wrong. Corrected in place with the correction marked,
rather than the old text deleted — the way it was wrong is the useful part.

## The test that matters

Not the one asserting the new default. This one:

```
it("cannot report more sales than presentations on the founder's own numbers")
```

It takes the founder's actual row — 20 knocked, 18 spoken to, 3 recorded, 10 sold — computes the
KPIs under the **old** default and asserts the close rate exceeds 1. That is the 333% that reached
their home screen as *"0 of 9 PRESENTATIONS"* beside *"9 of 1 SOLD"*. Then it computes them under
the corrected default and asserts the rate cannot exceed 100%.

The defect is now reproducible in the suite rather than described in a comment. A comment saying
"do not use recorded pitches" is exactly the prose A30 says will return.

## What was NOT built

The three exports are still uncalled. Wiring them is the Today's Metrics board, and that is the
next build — this one stopped to make the number correct before anything renders it, because a
board built on the wrong definition would have shipped the founder's own reverted bug back to
them.
