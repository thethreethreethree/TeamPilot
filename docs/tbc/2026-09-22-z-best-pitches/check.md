# CHECK — a rep's best pitches had no list

## Findings

### F1 — the board draws three best-pitch cards and nothing served them
class: drawn-without-a-source
sweep: grep the pitch-score lib and all seven routes for a list of pitches; read `bestPitchScore`'s derivation
severity: medium

`aggregatePitches` produces `bestPitchScore` from `reduce(Math.max)` — one number, no list, no
dates, no ids. Enough for the gauge's "Best 106.5" and nothing else. The mobile Progress board
shipped without the cards rather than inventing them, which is how this was found.

### F2 — "best" could have meant something different from "total"
class: two-definitions-of-one-word
sweep: read the rubric sheet's competition rules against the qualifying rule
severity: medium

A rep's best pitch must mean the same thing their total means, or the board celebrates a pitch that
contributed nothing to the figure printed beside it. The rubric is explicit: a pitch counts only
above the qualifying base, and "Best Pitch award goes to the highest single score" — total, not
base, because the bonus is part of what a rep competes on.

### F3 — a deleted session would have silently removed a real score
class: cascade-erases-a-fact
sweep: read the column definition rather than assuming the join
severity: low

`session_id uuid references coaching_sessions(id) on delete set null`. Filtering on a non-null
session would have dropped a rep's highest pitch because its recording was purged.

## What I did NOT do

The cards link to the WEB pitch detail; there is no mobile detail screen in this revision, by the
founder's own instruction. A rep tapping one leaves the app.

## Verification

  $ npx vitest run src/app/api/coach/sales-session/pitch-score/best
  Tests  9 passed (9)

  $ npm run check
  (recorded in closure)
