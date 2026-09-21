# BUILD

## Files

**`docs/SYSTEM UPDATES AND REVISION/TWO-SCORING-SYSTEMS.md`** (new) — every number both systems
print, with the status of each. Eight rows: one fixed, one live and scoped, four unbuilt with the
authority named, two clean.

**`src/components/sales-coach/ScoringRubricSheet.tsx`** — one competition rule scoped.

## The live inconsistency, and the smallest honest fix

The rubric sheet shipped earlier today telling reps:

> *"Leaderboard = total points from counted pitches."*

`/scoreboard` exists and ranks by the gamification ledger's `total_points` — the mean of the v5
dimension scores × 10, 0-100 per session. The Pitch Score total is base + bonus − violations,
0-130 per pitch. Different inputs, different scale, different number.

So the sheet asserted as current fact something the product does not do, and a rep who read it
and then opened Scoreboard would see a number computed from something else, unexplained. The band
collision again, in shipped copy rather than in code.

The rule is the founder's, from the rubric PDF, so it is **scoped rather than rewritten**:

> *"Pitch Score leaderboard = total points from counted pitches. (The Scoreboard tab still ranks
> by session points — the two are separate boards.)"*

Which board the nav should show remains the founder's call, and is row 2 of the map.

## What the map found that is not yet a defect

Two milestone collisions, caught **before** building the strip:

| Design | Existing | |
|---|---|---|
| "First pitch" | `spark` — *"First pitch scored"* | same event, two names |
| "Century — 100 scored pitches" | `century` — *"100 sessions"* | same event, two names |

Built fresh, a rep earns two First-pitch badges and two Centuries. This is the band collision's
exact shape, found one step earlier in the sequence — which is the entire value of writing the
table before wiring the surface.

## A claim of mine that was wrong, corrected before shipping

The first draft of the table described `competitionRanks` as **dense** ranking. Reading it: it is
**standard** competition ranking — `rank = i + 1` on a non-tie, so 1-2-2-**4**, not 1-2-2-3.

Worth keeping because it is the same failure the table exists to prevent, committed while writing
the table: a plausible description of an authority, written without opening it. The correction
also sharpened the row — the obvious hand-rolled ranker *is* dense, so a second implementation
would disagree the first time two reps tie.
