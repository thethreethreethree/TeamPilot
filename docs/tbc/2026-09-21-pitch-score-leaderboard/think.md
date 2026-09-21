---
started_at: 2026-09-21T23:00:00+08:00
trigger: The founder picked the rank/leaderboard collision as the next build. The rubric sheet (p.6) makes Pitch Score the competition leaderboard; the Scoreboard tab still orders reps by the older gamification system; and as of this afternoon a manager can move a Pitch Score, so a correction changes a rep's position on one board and not the other.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — two boards, one word, and a question neither document answers

## Why (the record)

`TWO-SCORING-SYSTEMS.md` mapped this in the morning and left it open. Its own residual said it
plainly:

> *"The copy is now honest, and the underlying situation is unchanged: if a Pitch Score board is
> built, the nav has two things called a leaderboard, ranking the same reps by different totals."*

Since then the override feature shipped, which makes it worse rather than merely untidy: a manager
can now change a Pitch Score. A correction moves a rep on a board that does not exist yet and does
not move them on the board that does.

## What the record had already decided, so I do not decide it again

Checked first, because this feature is where a duplicated decision would be most visible and least
detectable — everyone sees a leaderboard number, nobody sees the rule behind it.

| Question | Already decided by | Verdict |
|---|---|---|
| What does the board rank on? | `TWO-SCORING-SYSTEMS.md`, from the rubric | total points from **counted** pitches |
| What counts? | `scorePitch` / `QUALIFYING_MIN_BASE` | 40 base — the qualifying test |
| How are ties numbered? | `competitionRank.ts` | standard competition ranking, 1-2-2-4 |
| How many pitches for a prize? | `PRIZE_ELIGIBLE_MIN_PITCHES` | 5 |
| Per-rep totals | `aggregatePitches` | including *why* a pitch did not count |

Five decisions, none of them mine. The build is mostly wiring them together without letting a sixth
opinion in.

## The question neither document answers: who may see it

This is where the build stopped being mechanical.

`docs/SalesCoach-KPI-System.md`, which calls the clause non-negotiable:

> *"Cross-agent ranking exists for managers only, is never the default view, and is never how
> results are framed to the agent."*

The rubric sheet: Pitch Score **is** the competition leaderboard.

A competition no competitor can see is not one. A leaderboard a rep browses is what the KPI
document forbids. Both documents are in the tree, and neither is older or weaker than the other.

**The database had already answered, and had not been asked.** Migration 0252's select policy is
`rep_id = auth.uid() or is_sales_coach_manager()` — the KPI rule, encoded in RLS months ago by
someone solving a different problem. Which means a rep reading this board through their own client
would have received **a board containing only themselves, ranked first, every time**. Not an error
and not an empty state: a plausible, wrong, flattering board. That is the single most important
thing found before writing any code.

So the split: a manager sees the field, a rep sees only where they stand. It is a **concession, not
a resolution** — telling a rep their rank is still cross-agent ranking reaching the rep — and it is
recorded as section L of LOGIC-AND-CONTRADICTIONS.md rather than settled by whoever wrote the query.

The consequence for the build is that the protection **moves from the database to the route**. The
service role bypasses RLS by definition, so every guarantee the route has is one it performs
itself, and its tests exist largely to prove it still does.

## What could go wrong, before I look

Hypotheses first, per §1.5.2:

1. **A service-role read with no company filter.** Returns every tenant's pitches and ranks
   strangers together. No error, no empty result, a plausible board.
2. **Ranking without sorting.** `competitionRanks` does not re-sort by design. Handed unsorted rows
   it still returns ranks — ascending with array position.
3. **A rep receiving the field** through a component that infers the view from whether `rows`
   exists rather than from the verdict.
4. **A failed read rendering as an empty board**, which a manager acts on by concluding the team
   did nothing.
5. **Pitches with no rep** pooling into a nameless row holding real points.
6. **Total vs average.** An average-ranked board silently rewards the opposite behaviour, and both
   look correct in isolation.

All six became tests. All six became mutations.

## Session-read manifest

```json
[
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-21T23:02:00Z",
    "why_it_governs": "An authority computes a decision and returns a verdict; consumers branch on it and never re-derive it from the raw inputs it already judged.",
    "how_this_build_will_embody_it": "Five decisions consumed rather than re-made, and one consumed at the surface: the component branches on managerView rather than inferring the view from whether rows are present. Inferring is re-deriving an access decision the route already made, and the failure mode is exposing the field." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T23:03:00Z",
    "why_it_governs": "Four layers, foundation up; a feature that works in itself but breaks workflow continuity is incomplete.",
    "how_this_build_will_embody_it": "Layer 3 is why both boards sit on one page rather than the new one replacing the old. A rep who has been watching the points board all month must not find it gone, and must be able to see why the two disagree." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T23:04:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as polish.",
    "how_this_build_will_embody_it": "The rubric specifies a competition leaderboard, which means a rep must be able to see their standing. Rank visibility is the result, not presentation of it — which is why the rep view was built now rather than left as a manager-only board plus a follow-up." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T23:05:00Z",
    "why_it_governs": "Guide, don't overtake; the human's call stays the human's.",
    "how_this_build_will_embody_it": "Two authorities disagreed and I did not get to pick. The split honours the most of both that can be true, and the concession is written down as a concession so the founder can overturn it knowing what was traded." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T23:06:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible; measuring the wrong thing is worse than measuring nothing.",
    "how_this_build_will_embody_it": "Total-from-counted is defensible because both halves are visible on screen — the rule is printed, and each row shows counted against handed-in. A rep can see that 3 of their 4 pitches counted rather than wondering why their total looks low." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-21T23:07:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Why a rep is told they are ranked but not prize-eligible BEFORE the prize is given, and why skipped pre-verdict pitches are reported rather than folded in at zero. An unexplained number is the same as no number." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-21T23:08:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Six hypotheses written before any code; all six became tests and mutations. The board-of-one discovery came from asking who may see this before asking how to query it." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-21T23:09:00Z",
    "why_it_governs": "A feature depending on config outside the repo is incomplete until verified or documented.",
    "how_this_build_will_embody_it": "Checked and does not bind: no dashboard setting, allowlist, DNS or webhook. The service-role key is already required by every other RPC in this feature." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-21T23:10:00Z",
    "why_it_governs": "Ground-up auditing; a problem at layer N propagates upward.",
    "how_this_build_will_embody_it": "The missing companyId filter is a layer-1 defect whose symptom is a layer-4 one — a board that lists the wrong people. It was found by walking down from the surface question rather than up from the query." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-21T23:11:00Z",
    "why_it_governs": "Diagnose before patching; surface, don't overtake; trace interconnections before committing.",
    "how_this_build_will_embody_it": "The traced interconnection: adding repId to AggregablePitch and companyId to readPitchPeriod touches every existing caller of both. Optional on both, so no caller changes behaviour — but companyId is documented as required for service-role callers, because optional-and-load-bearing is the dangerous combination." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-21T23:01:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem was not a missing board. It was one word meaning two orderings, in one nav, with a manager now able to move one of them. Naming it that way is what made the answer two named boards rather than a replacement." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T23:12:00Z",
    "why_it_governs": "The governing methodology must be in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Both governing documents ARE in the tree, which is the only reason the contradiction was visible at all. Had SalesCoach-KPI-System.md lived outside it, the board would have shipped under the rubric alone with nobody aware there was a second authority." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-21T23:13:00Z",
    "why_it_governs": "Retrospective Identification: work from the record.",
    "how_this_build_will_embody_it": "The record is TWO-SCORING-SYSTEMS.md, which wrote down the ranking rule this build implements. The rule was read, not re-derived from the rubric a second time." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-21T23:14:00Z",
    "why_it_governs": "Outside-Perspective Identification.",
    "how_this_build_will_embody_it": "The outside reading of a rep seeing a board of one: it does not look broken. It looks like a rep who is winning. That is what makes it worth a service-role read and a hand-written access split." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-21T23:15:00Z",
    "why_it_governs": "Holistic: trace what else a change affects.",
    "how_this_build_will_embody_it": "Traced before editing shared types: AggregablePitch and readPitchPeriod are used by the rep board and the breakdown. Both additions are optional so no existing caller changes." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T23:16:00Z",
    "why_it_governs": "Learning is validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "30 mutations. A passing suite is a persuasive artifact; the two that mattered — rank-without-sorting and drop-the-company-filter — produce boards indistinguishable from correct ones, so only a mutation proves the tests see them." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-21T23:17:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "Applied to the ranking metric. Average felt obviously fairer and would have been a confident wrong answer; the record had already fixed total-from-counted, and the fixture is built so the two disagree." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-21T23:18:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "This build IS a picker answer — the founder chose the rank collision as next. The access split was not put to a picker because the founder had said to finish the remaining items; it is recorded as a concession they can overturn." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-21T23:19:00Z",
    "why_it_governs": "Append-only; state is derived by replaying events, never edited.",
    "how_this_build_will_embody_it": "The board is derived on every read from pitch_scores rather than materialised into a standings table. A stored ranking would have to be recomputed after every manager override, and would be wrong between the override and the recompute." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-21T23:20:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "The whole build is that seam, crossed in one go: module, route, component and page, with the page wired before the gate could report it reachable-but-unmounted." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-21T23:21:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is in a gate.",
    "how_this_build_will_embody_it": "The sort-before-rank coupling is the clearest case: a comment in competitionRank.ts already warned about it, and a comment is what A30 says is insufficient. The guarantee here is a test whose fixture is in worst-case order." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-21T23:22:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the run with its exit code and states the mutation tally as n-of-n rather than describing the tests as thorough." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-21T23:23:00Z",
    "why_it_governs": "The operational lesson behind §2.2 — a dropped term in a duplicated condition silently defeats a gate.",
    "how_this_build_will_embody_it": "Why the component consumes managerView. A re-derived access decision at the surface is A40's exact shape, and the dropped term would be the one that hides other reps." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-21T23:24:00Z",
    "why_it_governs": "Same-name-different-feature across modules; the user experiences a feature concept, not a module boundary.",
    "how_this_build_will_embody_it": "This build is A21's canonical case and its remedy. Leaderboard meant two things in one product. The fix is not to unify them into a wrong average but to name both on one page and say what each ranks." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-21T23:25:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration in this build. Stated rather than skipped, since the previous build in this session was entirely about it." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-21T23:26:00Z",
    "why_it_governs": "Methodology governing the build must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Both authorities were opened this session, which is the only reason section L exists. The standing exception is unchanged: the 2026-09-19 instruction image still cannot be displayed." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-21T23:27:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected.",
    "how_this_build_will_embody_it": "This block, including the entries that record an asset as NOT binding — which is the honest outcome for several of them and is written down rather than omitted." }
]
```
