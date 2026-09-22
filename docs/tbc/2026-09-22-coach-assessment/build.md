# BUILD

Project 3, data layer and page.

### The dashboard's arithmetic

- **write-path:** `src/lib/coach/assessment/teamAssessment.ts` — `sectionBars`, `priorityCards`,
  `rankReps`, `vsTeam`, `prizeEligibleCount`. Pure; no I/O. Each corresponds to a numbered item in
  the guide's Step 3 and the comment above it says which.
- **read-path:** `readTeamAssessment` consumes all five, and `teamAssessment.test.ts` exercises
  them directly — 23 tests, 15 mutants, none surviving.
- What it deliberately does NOT own: the lowest section (`lowestSection`, by percentage of max per
  C1), the band (`bands.ts`), the activity ratios (`computeActivityKpis`) and the team roll-up
  (`sumTeamTotals`). Four authorities consumed, none re-implemented.

### The read

- **write-path:** `src/lib/coach/assessment/readTeamAssessment.ts`. One bounded read of the
  company's scored pitches (`limit: 900`, the same bound the leaderboard and breakdown routes use)
  and one read of `rep_kpi_daily` for the period. Groups by rep, builds each rep's aggregate and
  KPIs, rolls up with `sumTeamTotals`, and returns the reps table already ranked.
- **read-path:** `GET /api/coach/sales-session/coach-assessment/dashboard?period=…`, manager-gated.
  Returns the team cards, the six bars, three priority cards, the ranked reps and a per-rep detail
  map. `capped` and `unattributed` are reported rather than inferred.
- A rep with door activity and no scored pitch still gets a row. They are exactly who the board is
  for, and keying only off `pitch_scores` would drop them.

### Priority cards, where the plan asks for a mapping that has no data

- **write-path:** the guide says *"map each priority to a rubric section"*, and the brief's themes
  carry no section — they come from pooled v5 growth areas, a different vocabulary from the six
  rubric sections. `priorityCards` matches a theme's stemmed tokens against each section's label
  and its elements' labels, longest phrase wins, one section per card; a theme that names nothing
  is assigned the largest remaining gap and the card carries `matched: false`.
- **read-path:** the NUMBERS on every card are the section's — team average and points-per-pitch
  left, from the aggregate. Only the words come from the theme. So an assigned card is still
  factually correct about the section it names; `matched` exists so a surface can avoid presenting
  an assignment as a finding.
- Substring matching was the first attempt and failed on the obvious case: the theme "say the
  TRANSITION out loud" does not contain the string "transitions". Tokens with the plural stripped.

## What was built and deleted before it shipped

Recorded because the deletions are the build's main finding, not an embarrassment to omit.

- **`supabase/migrations/0259_rep_activity.sql`** — the table the guide's data model specifies.
  Written, applied, RLS-allowlisted, gate-clean. Deleted on the founder's ruling once
  `rep_kpi_daily` was found: a VIEW over `door_knocks` grouped by (company, rep, local_date),
  returning `doors_knocked`, `sold`, `no_answer` and three more, `security_invoker = on`. The
  guide's table already existed under another name, with more columns, and as a view it cannot go
  stale. 0259 would have been a physical cache of a live view over the same rows. Never pushed.
- **`activityRates()`** in `teamAssessment.ts` — presentations ÷ doors and sold ÷ presentations,
  null on an empty denominator. `computeActivityKpis` already did exactly that, including the
  null-not-zero rule and nearly the same comment. Deleted with its four tests.

### The page, rebuilt to the board

- **write-path:** `CoachAssessmentBoard.tsx` renders the guide's Step 3 in its order — one period
  toggle governing everything, four team cards, the activity row, six rubric bars with the lowest
  flagged, Needs-your-attention, three priority cards, the reps table, and rep detail. The page
  itself is now a thin wrapper: TopBar, the Scoring rubric button, `DisputeQueue`, the board.
- **read-path:** two fetches, deliberately separate. The dashboard route supplies everything Pitch
  Score; the existing `/coach-assessment` route supplies the coaching notes it has always owned.
  Joining them server-side would put one route in charge of two scoring systems, which is what
  `TWO-SCORING-SYSTEMS.md` exists to prevent; they meet on rep id at the surface, which is the only
  place a manager reads them together. 19 render tests.

## Nothing from the old page was dropped

The old page was 680 lines and the ruling was to replace it. Each piece has a home, and the two
that nearly went missing were caught by gates rather than by care:

| was | is now |
|---|---|
| Sales ELO Rating as the page headline | `AgentGradeBadge` in the reps table and rep detail |
| Doing well / Coaching focus | rep detail Overview, same route as before |
| Skill scores + process breakdown | `RepSkillGrades`, **extracted** to its own component |
| "Generate missing" | Needs-your-attention, which the guide says to keep it in |
| Door metrics | the reps table's Doors / Pres. / Sold and the rep KPI tiles |
| `DisputeQueue` | kept above the board, at page level |

- **The badge was the wrong one.** I used `AgentEloBadge` (the raw ELO number and gauge) where the
  board's column is headed COACHING GRADE and shows "B+ Solid" — the letter. `AgentGradeBadge` is
  its Standard-mode counterpart on the same endpoint. Caught because deleting the old page
  orphaned `AgentGradeBadge` and `reachability:audit` said so; the orphan was the symptom of using
  its sibling by mistake.
- **`RepSkillGrades` was extracted rather than rewritten.** Rewriting six /10 scores would have
  produced a second reading of them, which is the duplicate this build already made once.
