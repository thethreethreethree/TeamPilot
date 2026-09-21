# BUILD — the competition board the rubric already specified

### The board itself, consuming three authorities

- write-path: `src/lib/coach/pitchScore/leaderboard.ts` — `buildPitchLeaderboard` groups a
  company-wide period read by rep and returns ranked rows. Pure, so it is tested without a
  database.
- write-path: three decisions are **consumed, not re-made** (§2.2). The per-rep totals come from
  `aggregatePitches` (including which pitches count and why not); the rank numbering from
  `competitionRanks` (standard competition ranking, 1-2-2-4); the prize threshold from
  `PRIZE_ELIGIBLE_MIN_PITCHES`. Each has been duplicated in this codebase before, and each
  duplicate agreed with its authority on the day it was written.
- write-path: the ranking rule is not invented either — `TWO-SCORING-SYSTEMS.md` already recorded
  it from the rubric sheet: *"Pitch Score leaderboard = total points from counted pitches."*
  Counted means qualifying, so a rep cannot climb by handing in pitches that never reached
  Discovery.
- write-path: the rows are **sorted before ranking**, and a comment says why. `competitionRanks`
  documents that it ranks rows *already* ordered and deliberately does not re-sort. Handed an
  unsorted array it does not throw — it returns ranks ascending with array position, which looks
  exactly like a working board.
- write-path: a pitch with no `repId` is dropped rather than pooled under a blank key. A pooled row
  would appear as a nameless rep holding real points, which is worse than a missing rep: it is a
  number nobody can attribute or dispute.
- read-path: `standingOf` returns null, never a zero row, for a rep with no scored pitch. A rep who
  has not been recorded this week has not lost the competition.

### `repId` reaches the aggregator, and `companyId` reaches the query

- write-path: `AggregablePitch` gained an optional `repId`, populated by `readPitchPeriod`. Without
  it a company-wide read could not be grouped by rep at all — the leaderboard was **unbuildable on
  this type**, not merely awkward.
- write-path: `readPitchPeriod` gained a `companyId` filter, and this one is load-bearing. A
  caller-scoped client is filtered by RLS so omitting it is safe there; the **service role has no
  RLS**, and the same query without it returns every pitch in every company on the instance. No
  error, no empty result, nothing in a type to catch it — just a board that ranks strangers
  together.
- read-path: both fields are **optional**, so every existing caller of `AggregablePitch` and
  `readPitchPeriod` — the rep's own board and the breakdown surface — is unchanged and keeps
  reading exactly what it read before. Nothing that worked this morning behaves differently.
- read-path: the leaderboard route is the only caller that passes either, and it passes both. The
  docblock on `companyId` states that it is required for a service-role caller, because
  optional-and-load-bearing is the dangerous combination and a type cannot say so.

### The route: two callers, two answers

- write-path: `src/app/api/coach/sales-session/pitch-score/leaderboard/route.ts`. A manager gets
  the field; a rep gets their own standing and the size of the board, and nothing that names anyone
  else.
- write-path: the tenant is proven on the way in. A manager's company comes from
  `requireSalesCoachManager`'s verdict; a rep's is resolved through their **own** client, so RLS
  decides which profile row they may read. Neither is taken from anything the caller sent.
- write-path: the service role is used for both, deliberately. A rep cannot read other reps'
  pitches under RLS and needs the whole company to know their own rank; a manager could read them
  but would then be running the board through a different client than the rep does, and two code
  paths producing one number is the shape that drifts.
- write-path: names are looked up only for the manager view, filtered by the proven company **and**
  by the rep ids already on the board — so it cannot become a roster read. A failed name lookup
  degrades to "Name unavailable" rather than returning 500, because withholding the scores over a
  missing name is the worse trade.
- read-path: `GET …?period=week|month|all`. An unknown period reads as all time rather than
  erroring.

### The surface, and the collision it closes

- write-path: `src/components/sales-coach/PitchLeaderboard.tsx`. Three states — loading, failed,
  ready — because a failed read rendering as an empty board tells a team nobody pitched, and a
  manager acts on that by believing it.
- write-path: the component branches on the `managerView` **verdict**, never on whether `rows`
  happens to be present. An absent array and a withheld array look identical, so inferring would
  mean a rendering bug could expose the field. A test asserts the field stays hidden even when rows
  arrive alongside `managerView: false`.
- write-path: the ordinal handles 11th, 12th and 13th — the cases a last-digit rule gets wrong.
- write-path: the rule is printed on screen — *"Total points from counted pitches … equal totals
  share a place."* A leaderboard whose rule is invisible is what this whole collision was about.
- read-path: `/dashboard/sales-coach/scoreboard` now carries **both** boards, each saying what it
  ranks, Pitch Score first. That is the close of R3 from the two-systems map — "two things called a
  leaderboard in one nav, ranking the same reps by different totals". Showing one and dropping the
  other is tidier and loses information the team already uses: the points board counts activity,
  this one counts quality on the pitches that qualified.
