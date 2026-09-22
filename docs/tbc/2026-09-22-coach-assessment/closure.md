# CLOSURE — the table the guide asked for already existed

## What shipped

Project 3's data layer: the dashboard's arithmetic, the read that assembles it, and a
manager-gated route. Not the page. That is named below as the top residual rather than implied by
a percentage, which is how this project went missing in the first place.

## What this build got right, and it was not the code

It deleted more than it added, twice, and both deletions were of things that already worked.

`0259_rep_activity.sql` was written, applied against real Postgres, RLS-allowlisted with three
reasoned entries, and gate-clean. Then `rep_kpi_daily` turned up — a view over the same rows with
four more columns and no staleness — and the right move was to delete a migration I had just
proved correct. `activityRates()` was the same shape: correct, tested, and a duplicate of
`computeActivityKpis` including its null-not-zero rule.

Correct-and-redundant is harder to throw away than wrong, because there is nothing to point at.
The only signal was a grep run for an unrelated reason.

## The thing I keep doing

Three separate decisions went to the founder on the activity source, and each was made on
information I had not finished gathering. Round one: I knew `door_knocks` existed. Round two: I
found `tallyKnockOutcomes`, the tested authority for what counts as a door. Round three: I found
`rep_kpi_daily`, which is the table the guide asked for.

Every ruling was correct on what it had. The failure is upstream of all three — I brought a
decision before finishing the search, and the founder spent three rulings on one question. The
generalisable fix is in remediate.md and it is small: **search for the number, not the table.**
`grep -rn "doorsKnocked" src/lib/` found in one command what three rounds of schema greps missed,
because the view is named for what it reports rather than for what it counts.

## The un-named reliance

- **That `rep_kpi_daily` is fast enough.** It groups `door_knocks` on every read. Nothing has
  measured it, and the dashboard calls it for a whole company and period.
- **That the brief's rep names match `profiles.full_name` exactly.** `repFocus` is keyed by the
  name the LLM was given; the reps table joins on it. A middle initial would silently drop a
  rep's focus to null, and null renders as "Not in this brief", which reads as a finding.
- **That three themes exist.** The board draws three priority cards; the brief's prompt asks for
  "2-3". Two themes produce two cards and nothing says the third is missing rather than absent.
- **That a manager wants the whole company.** The read has no rep filter and no pagination beyond
  the 900 bound.

## Residual

```json
[
  { "id": "R1-the-page-is-not-built",
    "item": "/dashboard/sales-coach/coach-assessment is still 680 lines of the old Sales ELO layout. The data layer behind the new board exists and nothing renders it.",
    "why_skipped": "Ran out of turn. The read and the route are the half that had to exist first — a page against no data would have been the A31 seam from the other side.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T09:40:00+08:00",
    "outcome": "OPENED, and it is the whole point of the build. A manager opening the product right now still sees the old page, exactly as they did before this build started — the difference is only that the numbers behind the new one now exist and are tested. This is the residual that must not be averaged into a percentage: the last time a project was missing, it was reported as a layer at 60% rather than as absent, and the founder found it by sending a screenshot." },

  { "id": "R2-the-old-page-s-contents-have-nowhere-to-go-yet",
    "item": "The ruling was to rebuild the page and move the ELO rating, skill scores, strategy tags, doing-well and coaching-focus into the rep detail Overview tab. The read layer returns none of those yet.",
    "why_skipped": "They come from the existing /coach-assessment route, which the new read does not call.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T09:41:00+08:00",
    "outcome": "OPENED. The guide is explicit that the coaching grade and notes STAY, and `RepRow` already carries `coachingGrade` and `coachingGradeNote` — but nothing populates them, so today they are always null. A page built against this read would silently drop a live feature while appearing to keep a column for it, which is worse than not having the column." },

  { "id": "R3-the-read-layer-has-no-tests",
    "item": "teamAssessment.ts has 23 tests and 15 caught mutants. readTeamAssessment.ts has none — the grouping, the per-rep KPI assembly, the unattributed guard and the sum-to-rows identity are all unexercised.",
    "why_skipped": "Turn length. The pure layer was tested first because it holds the rules.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T09:42:00+08:00",
    "outcome": "CLOSED before the build ended. `readTeamAssessment.test.ts` has 10 tests and 8 mutants, 6 caught: the sum-to-rows identity across two reps, the unattributed-pitch guard, the rep with doors and no pitches, the founder's presentations definition, and a failed read returning null rather than an empty team. One survivor was equivalent (a type assertion), one was a real gap in ordering and is now pinned. The checklist line is a gate rather than a promise." },

  { "id": "R4-presentations-mean-two-things-and-the-product-already-chose",
    "item": "The guide lists presentations-source as an open decision and says the mockups assume recorded pitches. `countPresentations` records the founder's 2026-09-11 definition: doors spoken to, not recorded pitches.",
    "why_skipped": "Consuming the existing decision was the correct default; re-opening it was not this build's call.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T09:43:00+08:00",
    "outcome": "OPENED and surfaced to the founder rather than resolved. It matters because the two definitions diverge exactly when a rep knocks doors without recording — which is the common case — and the door-to-presentation ratio on the manager's dashboard is built on it. The function keeps the alternative one argument away, which is the right shape for a question that is still live." },

  { "id": "R5-sixteen-builds-and-nothing-rendered",
    "item": "No surface built in this session has been seen in a browser.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T09:44:00+08:00",
    "outcome": "OPENED. Today this residual stopped being theoretical: the deploy went out, so the sidebar, the Breakdown board and Pattern Interrupt are now in front of real users having never been looked at by their author. The images opening after twenty-two builds of 'cannot be displayed' is the standing reminder that a carried residual is not a gate." }
]
```
