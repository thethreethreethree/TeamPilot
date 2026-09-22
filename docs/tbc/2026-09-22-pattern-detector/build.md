# BUILD

Six features. Three are Pattern Interrupt; three are corrections the boards forced on surfaces
already shipped.

### Pattern detection

- **write-path:** `src/lib/coach/patterns/detect.ts` — `detectPattern(applicablePitches, maxPoints,
  isMiss)`. Opens at `MISS_THRESHOLD` (3) misses inside `WINDOW` (10) **applicable** pitches,
  returns the strip, the counts and `costPerPitch` (average points lost per applicable pitch, for
  the caller to freeze). `missedOnly` is the default predicate and `missedOrPartial` is exported
  beside it — B4 asks for a parameter, not a choice, and the record says flipping it "changes how
  many patterns open for every rep in the product".
- **read-path:** `cleanStreak` is exported from the same module and consumed by the status
  resolver, so "clean" has one definition. Two definitions — one in detection, one in the fix rule
  — would clear patterns that detection immediately re-opens. 19 tests; 7 mutants, none surviving.

### The status resolver, and the C8 ruling

- **write-path:** `src/lib/coach/patterns/status.ts` — `statusOf()` returns a **verdict**
  `{ status, open, reason, streak }`. Five branches ordered most-conclusive-first so the states
  cannot overlap: fixed (explicit, or 5 clean applicable in a row) → new (never coached) →
  improving (first-5 vs last-5, per the guide) → stalled (coached 7+ days, no streak, no
  improvement) → coaching.
- **read-path:** `countPatterns()` returns `open` AND `openNotImproving`, which are the board's two
  numbers for one rep — Anthony A.'s chip reads 3 and his rep-progress line reads "2 open". Both
  are computed here so no surface subtracts one from the other. `open` is a FIELD; nothing
  downstream writes `status !== "fixed"` (§2.2). 20 tests, plus a control test that proves by
  exhaustion that the guide's "at least one clean pitch" term is implied by its rate test rather
  than untested. 12 mutants, none surviving.

### Storage

- **write-path:** `supabase/migrations/0258_pattern_interrupt.sql` creates `patterns` (identity plus
  the facts frozen at detection — misses, applicable, strip, `cost_per_pitch`, `first_seen`,
  `rubric_version`) and `pattern_events` (append-only, the guide's six kinds verbatim). A partial
  unique index `(company_id, rep_id, item_id) where fixed_at is null` makes a duplicate open
  pattern impossible rather than unlikely. No status column — the guide's Step 5 says drive it from
  data and events, which the resolver does.
- **read-path:** RLS is 0252's existing two-branch rule, own-row-or-company-manager, using the SAME
  `is_sales_coach_manager()` predicate rather than a second definition of who a manager is (A21).
  No insert/update/delete policies: detection runs server-side and every human action is an
  appended event. All six write operations are allowlisted in `rls-audit.mjs` with their reasons.
  Applied and re-applied against real Postgres 16 — 256 migrations, 0 failures.

### The board

- **write-path:** `src/lib/coach/patterns/readPatterns.ts` — `readApplicableGrades()` reads a rep's
  graded elements joined to `pitch_scores` for `recorded_at` (the elements table has only
  `created_at`, which is when the scorer ran, not when the pitch happened); `readPatterns()`
  resolves every pattern's verdict once and returns the counts with it; `teamWidePatterns()` counts
  REPS per item as a Set, so a rep with two patterns on one item cannot inflate the 3+ threshold.
  `GET /api/coach/sales-session/patterns` passes the caller's client so RLS is the access rule.
- **read-path:** `PatternInterrupt.tsx` renders the boards' two-column body — pattern cards with a
  dot strip, status pill and "5 of 7 · −2.1 pts/pitch", beside a detail panel with the verdict's
  own reason and a five-segment path-to-fixed bar. A failed read renders as a failure with a retry,
  never as an empty board: on this screen "no patterns" reads as praise. 15 render tests.

### The nav, rebuilt from the boards

- **write-path:** `SalesCoachShell.tsx`. Founder ruling 2026-09-22, "follow the boards literally".
  MANAGER DASHBOARD is Coach Assessment, Score Calibration, Pattern Interrupt [NEW]. MY COACHING is
  three items, not six. TEAM TOOLS is the union of the two boards' bottom groups, with KPI Analytics
  and My Progress manager-only so each role sees what its own board draws.
- **read-path:** `reachability:audit` is clean. Checked rather than assumed: Analytics and Sessions
  survive in `MOBILE_TABS`, Role Play in `MACRO_MOBILE_TABS` — which is already exactly the rep
  board's bottom bar, Home · Pitch Performance · Today's Metrics · Role Play. Three destinations are
  now unlinked anywhere: **Training, Team and One Liners**. That is the ruling applied, and it is the
  build's open item, not a silent consequence.

### The Breakdown board, reduced to one callout

- **write-path:** `PitchBreakdown.tsx` keeps BIGGEST OPPORTUNITY and drops "Most improved" and "Your
  strongest"; the truncation notice stays an inline line rather than a fourth bordered box. The
  breakdown route's second database read went with them, and `improvement.ts` was deleted rather
  than left unwired — an unadopted primitive is the debt this repo already names in `fetchJson.ts`.
- **read-path:** two tests assert the single callout renders above the section bars and that
  neither removed callout is present. Page 2 of `EloState Rep Pitch Dashboard.pdf`, opened
  2026-09-22, carries exactly one.

### Detection runs on every scored pitch

Guide Step 5: *"Run detection every time a pitch is scored."* Closing R1 of this build's own
closure, which was the worst thing in it — the board could read patterns and nothing wrote one, so
"nothing has been missed in 3 or more of your last 10 pitches" was a claim nothing had earned.

- **write-path:** `src/lib/coach/patterns/runDetection.ts`, called from the pitch-score route AFTER
  `storePitchScore` (the new pitch must be in `pitch_score_elements` before it can be part of its
  own last-ten). Service-role client, because `patterns` has no insert policy — a caller-scoped one
  would write nothing and report success. Idempotent by the partial unique index rather than by a
  read-then-write, so two pitches scored seconds apart cannot race, and `opened` is read back from
  what the database ACCEPTED rather than from what was offered.
- **read-path:** the board. A failure logs with the rep and company id and returns a result; it
  never fails the request, because the rep's score is already saved and telling them the pitch
  could not be scored would be false. 13 tests, 8 mutants, none surviving.
- Writes no `pattern_events` row: `detected` is not one of the guide's six kinds — all six are
  things a human did — and 0258's CHECK would have rejected it at runtime, on a path that had
  already returned 200.

### Missed opens, Hit clears

Founder ruling 2026-09-22, from a question this build raised rather than one it was asked.

- **write-path:** `detect.ts` gains `CleanPredicate` and `doneRight`; `cleanStreak` takes it instead
  of the miss predicate, and `statusOf` threads `isClean` through. Detection is untouched —
  `missedOnly` still opens patterns, so no new ones appear.
- **read-path:** the five-segment PATH TO FIXED bar now counts hits, matching its own caption
  ("Done right in 5 pitches in a row"). Before this, five consecutive Partials cleared a pattern for
  a rep who had never once landed the point.
- It also makes the guide's Improving rule whole: the "at least one clean pitch" term was
  mathematically implied under one shared predicate — mutation S2 proved it dead — and under two it
  is the only line separating "the miss rate fell" from "they are actually landing it". S2 is now
  CAUGHT, and `statusRedundancy.test.ts` pins both the new case and the old implication, so
  reverting the predicates cannot silently re-kill the rule.
