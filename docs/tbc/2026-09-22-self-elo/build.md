# BUILD — the rep against their own past

### A verdict, not a number

- write-path: `src/lib/coach/pitchScore/improvement.ts` — `biggestImprovement(current, previous)`
  returns one of three states: `improved`, `no_change`, `insufficient`. Pure.
- write-path: **the understanding gate is the hard part, not the subtraction.** A comparison of one
  pitch against one pitch is arithmetic, not evidence — a single Hit moves an element's average by
  its full value. `MIN_PITCHES_FOR_COMPARISON = 3` is the smallest count at which one pitch cannot
  dominate the comparison on its own, and it is named as a judgement rather than buried in an
  inequality.
- write-path: `no_change` is a real answer and is NOT folded into `insufficient`. Telling a rep the
  system could not tell, when it could and the answer was "nothing rose", is a lie in the
  flattering direction.
- write-path: an element with no baseline is skipped. Its "gain" would be its entire value, so it
  would win every comparison and tell a rep they improved most at the thing they have done once.
- write-path: a floor of 0.2 points, because two one-decimal averages subtract badly and a move
  below that is rounding rather than growth.
- read-path: the caller is told which case it is in, so it can render the third rather than
  guessing from a null.

### The second read, and why it is worth a round trip

- write-path: `previousWindow(period, now)` — the window immediately before the current one, same
  length, as a half-open range. Both windows containing a boundary pitch would make it its own
  baseline and flatten every comparison toward zero.
- write-path: the breakdown route reads it and aggregates it. **Best-effort**: a failed baseline
  read must not fail the board, because the current period is still true and the verdict degrades
  to `insufficient`, which the surface already has to render.
- read-path: "all time" has no before, and says so in the reason rather than returning an empty
  comparison.

### Growth first, then strength, then the gap

- write-path: `PitchBreakdown` renders the verdict above the strength callout added earlier today.
- write-path: **insufficient is rendered, not hidden.** Falling back silently to the strength would
  look like an answer to a question that was never answered — and principle 3 of the KPI document,
  which is §3.2 in that document's own words, makes "insufficient data" a state a rep must see.
- read-path: *"Tone and certainty: 4.5 → 6.9 per pitch · Up 2.4 points a pitch on the period before
  this one."* Before and after, not only a delta: one tells a rep where they are, the other only a
  direction.
- read-path: the insufficient state carries the REASON and what would fix it — *"2 counted pitches
  in this period"*, *"Three counted pitches in each period are needed before a change means
  anything."*
- read-path: a response with no verdict at all renders the board unchanged, which is the
  rollout-skew guard this component already carries for other optional fields.
