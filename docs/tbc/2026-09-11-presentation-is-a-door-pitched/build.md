# BUILD - a presentation is a door you pitched, not a door you recorded

### Count today's three figures from one table
- write-path: `src/app/api/coach/doorlog/day-target/route.ts` - the presentations count moves from
  `pitches` (by `recorded_at`) to `door_knocks` with `.neq("outcome", "no_answer")` on the rep's
  local date, which is the same table and the same date column the other two already use.
- read-path: the door home screen's middle dial. "0 of 9 PRESENTATIONS" beside "9 of 1 SOLD"
  becomes impossible, because sold is now a subset of the same set presentations is drawn from.

### Count the 30-day ratio window the same way
- write-path: `src/lib/coach/doorlog/dayTargetData.ts` - the same swap in the window that feeds
  `closeRatio` and `contactRatio`. `sinceTs` is deleted; it existed only to bound the pitches query
  by a timestamp, and the knock window is bounded by `local_date` like its two siblings.
- read-path: the target sentence on the same screen. Close ratio falls from an implausible 78% to
  about 25% across production; contact ratio rises from 12% to 37%.
- read-path: for a rep who was ALREADY qualified, the door target barely moves.
  `doorsTarget = ceil(soldTarget / close) / contact`, and with `close = sold/presentations` and
  `contact = presentations/doors` the presentations term cancels - only the intermediate `ceil()`
  survives.
- read-path: **for a rep who CROSSES the qualification gate it moves a great deal**, and this was
  missed on the first pass. `qualified` requires 10 presentations, so raising the count flips two
  reps from the STARTER ratios to their own. Alejandro Salazar goes 7 recorded to 23 spoken; the
  founder goes 3 to 18. Their door target for a one-sale goal moves from 40 (the starter 1/9 and
  1/4.4) to 25 and to 20 - the founder's landing on `DOORS_FLOOR`, which is what bounds the damage
  when a rep's own ratios are thin.
- read-path: the founder's screenshot said "1 sale per 9 presentations and 1 presentation per 4.4
  doors" - those ARE `STARTER_CLOSE_RATIO` and `STARTER_CONTACT_RATIO`, and his frozen row carries
  `used_starter = true`. The sentence was never about him; he had 3 recorded pitches against a
  qualifying minimum of 10.

### Make the manager's all-time figure agree
- write-path: `src/lib/data/doorlog.ts` `getAllTimeKpi` - presentations are now
  `doors_knocked - no_answer` summed from the SAME `rep_kpi_daily` rows that already supply knocked
  and sold. This drops a query rather than adding one, and removes the second source that was the
  whole fault.
- write-path: floored at zero, so a rollup row with more no-answers than knocks yields 0 rather than
  a negative count that would read as a number instead of as nonsense.
- read-path: the coach-assessment page a manager reads. Moses's all-time close ratio moves from 90%
  to 36%; the second is the believable one and always was.

### Make the windowed Today's Metrics figure agree
- write-path: `src/lib/data/doorlog.ts` `getTodaysMetrics` - the windowed count moves off `pitches`
  (which reached its window through a `door_knocks!inner(local_date)` join) onto `door_knocks`
  directly, so the source matches the window instead of only the window matching.
- read-path: the Today's Metrics trio, whose "conversations" IS this number.

### Correct the product knowledge the assistant reads out
- write-path: `src/lib/care/elostateProductKnowledge.ts` - "(a presentation is a recorded pitch)"
  became "(a presentation is a door where the rep actually spoke to somebody)".
- read-path: anything the C.A.R.E assistant says about how the door tracker works. A stale
  definition here is a confident wrong answer given to a customer.

### Teach the test stub to tell three queries apart
- write-path: `src/lib/coach/doorlog/__tests__/dayTargetData.test.ts` - all three counts now come
  from one table, so the stub can no longer distinguish them by table name. It watches the FILTER:
  unfiltered is doors, `.eq("outcome","sold")` is sold, `.neq("outcome","no_answer")` is
  presentations.
- read-path: the 123 assertions in `src/lib/coach/doorlog` keep meaning what they say. Without this
  nothing would fail while two of the three counts resolved to the same number - a stub that
  distinguishes queries by TABLE stops distinguishing anything the moment they share one.
