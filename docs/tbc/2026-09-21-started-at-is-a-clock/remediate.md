# REMEDIATE

### 159 build records declare a start later than the commit that shipped them

gate-or-promise: gate
- `checkStartTimes` in `scripts/tbc/verify-freshness.mjs` fails any build dir in the diff whose
  `started_at` is more than five minutes after the commit that added its `think.md` — or after
  `now`, for a dir not yet committed. It runs inside `tbc:freshness`, which is already in
  `npm run check` and in CI, so it needs no invocation and no author cooperation.
- The comparison is deliberately against the record's own commit rather than against `now`: a
  record claiming a start an hour after it shipped is just as false a year later, and `<= now`
  stops seeing it the moment that hour passes.
- **The 153 historical records are kept, not corrected.** Each is allowlisted by name with its
  measured overshoot and which of the two causes it is — a timezone mislabel or a real overshoot.
  §3.1: the record is append-only, and a fabrication that has been found is an asset. Rewriting the
  timestamps would produce a clean-looking history and destroy the evidence that the gate's own
  design caused the drift. This is the reversible default; whether the founder prefers correction
  is their call and is put to them, not settled here.

### currentBuildDir could be captured by a single future-dated record

gate-or-promise: gate
- Two changes, because the obvious one expires. `pickLatestBuildName` demotes a `started_at` later
  than `now` to the name tier, which removes the pressure that produced the drift — an honest
  reading now outranks a future-dated predecessor, so a new record no longer has to out-declare the
  last one to be selected. And `currentBuildDir` excludes every dir named in the freshness
  allowlist, which is the durable half: without it the overshoot records stop being "future" one by
  one through the evening and take the selection back.
- Pinned by `pickLatestBuild.test.ts` — the regression case names `2026-09-22-self-elo` and the
  honest dir that follows it, and fails if the demotion is removed.

### The instant comparison was a string comparison

gate-or-promise: gate
- `Date.parse` and numeric comparison, with an unparseable value treated as absent. The test pins a
  `+08:00` value that means an *earlier* moment than a `Z` value, which is the pair the old code
  ordered backwards; mutation `M1 back to the raw string sort` is caught.

### The tier in the sort key was untested

gate-or-promise: gate
- A case with a transposed year (`0202-09-21`) fixes the contract that any real timestamp outranks
  a dir with none, including below the epoch where a real instant is negative. Mutation
  `M4 ignore the tier` now fails.

### The breakdown route truncated soonest and said nothing

gate-or-promise: promise
- Declined, with the hole named. The rule would be "every route over a bounded read reports the
  bound", and there is no precise mechanical form of it: a route may legitimately consume a read
  whose truncation does not affect its output, so a check that flags all of them would flag correct
  code. A30 is explicit that a noisy gate is worse than none, because it teaches people to skip it.
- What exists instead is narrower and holds by construction: `readPitchPeriod` returns `capped` as
  part of its result, so a caller has to actively discard it rather than forget to compute it. All
  three call sites now pass an explicit limit and forward the verdict. The hole is that a *fourth*
  call site could still drop it silently, and nothing would fail.
