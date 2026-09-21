# BUILD — the bound reports itself

### `readPitchPeriod` returns whether it was truncated

- write-path: `PeriodRead` gains `capped: boolean`, set at both return sites from
  `rows.length >= limit`.
- write-path: **`rows`, not `pitches`.** A pitch scored before the section verdict existed is
  skipped AFTER the query, so comparing the mapped array would under-report a read that genuinely
  filled its limit — and the caller would be told a truncated period was complete.
- write-path: an empty read is `capped: false`. Saying otherwise would tell a caller the period was
  truncated when it was simply empty.
- write-path: the docblock says what a truncation COSTS depends on the read's order, which is why
  the field is called `capped` and not `wrong`: newest-first loses the oldest pitches, `oldestFirst`
  loses the newest. Milestones survive it; a leaderboard total does not.
- read-path: both routes consume the verdict. Neither counts rows.

### The duplicated decision this ends

- write-path: the milestones route shipped yesterday with `capped: read.pitches.length >= 900` — a
  re-derivation of a decision the reader had already made, against a constant copied out of it. It
  would have kept answering 900 the first time the limit moved (§2.2), and it counted the wrong
  array besides.
- write-path: it now reads `capped: read.capped`.
- read-path: the route test asserts the verdict is **consumed**: one pitch with `capped: true` must
  report true, and 900 pitches with `capped: false` must report false. A recounting route fails
  both.

### The leaderboard says it out loud

- write-path: `/pitch-score/leaderboard` returns `capped` at all — it previously did not report it
  in either response shape.
- write-path: `PitchLeaderboard` renders a notice when it is true, for managers **and** reps: a
  rep's standing is computed from the same truncated set, so their rank can be wrong too.
- read-path: *"This period has more pitches than one read returns, so the board covers only part of
  it. A shorter period will be complete."* — a caveat with an action in it.
- read-path: this is the one caveat on that screen that can change the ORDER rather than a number.
  The board sums a period; losing its oldest pitches lowers real totals and can move a rep past
  another. Closes R3 of the leaderboard closure and R5 of the milestones closure, which recorded
  the same gap twice without fixing it.
