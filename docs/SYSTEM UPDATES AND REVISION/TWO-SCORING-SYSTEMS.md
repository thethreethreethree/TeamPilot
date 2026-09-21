# Two scoring systems, one product — the collision map

**Written 2026-09-21**, after a band table was duplicated and shipped, and the duplicate rendered
on the same page as the original.

The build guide says the Pitch Score *"runs beside"* the existing letter grade and skill scores.
That is the intent and it is fine. What "beside" needs, and did not have, is **a list of every
number both systems print** — because the collision is never in the feature, it is in the pair.

This document is that list. Its purpose is prevention: before wiring any Pitch Score number to a
surface, check this table.

## The two systems

| | **Gamification** (shipped, live) | **Pitch Score** (built 2026-09-19→21, mostly unwired) |
|---|---|---|
| source | v5 after-pitch dimension scores, 0-10 each | AT&T Fiber rubric, 30 elements + bonuses − violations |
| per-session number | `computeSessionPoints` = mean × 10 → **0-100** | `scorePitch` = base + bonus − violations → **0-130** |
| stored in | the points ledger | `pitches` |
| rubric version | `RUBRIC_VERSION = "v1"` | `RUBRIC_VERSION = "attfiber-v1"` |
| design note | *"DECISION: reuse, not a second judge"* | the rubric is a second judge, by design |

Both are correct. They measure different things — one is the LLM coach's read of the
conversation, the other is a fixed checklist — and the founder asked for both.

## Every number, and whether it collides

| Number | Gamification | Pitch Score | Status |
|---|---|---|---|
| **Band** | `bands.ts` — Elite / Strong / Solid / Developing / Needs coaching | *was* a local four-band copy | ✅ **FIXED 2026-09-21.** Collided on one page: 95 read Elite in the Arena gauge and Strong in the card below. Now consumes the authority; a test pins agreement at every half-point 0-130. |
| **Leaderboard total** | `total_points` on the ledger, ranked by `competitionRanks`. Live at `/scoreboard`. | rubric: *"Leaderboard = total points from counted pitches"* | ⚠️ **FOUNDER DECISION.** Two different totals. The rubric sheet's line was scoped to say which board it means (2026-09-21) so it no longer asserts something the product does not do — but there is still no Pitch Score board, and if one is built the nav will have two things called a leaderboard. |
| **Rank** | `competitionRanks` — STANDARD competition ranking (1-2-2-**4**, not dense 1-2-2-3); ties share a rank and the next rank skips | design shows *"#2 on your team this week"*, *"rank #2"* | ⚠️ **UNBUILT — use the authority.** `competitionRanks` exists and is tested. A second ranker would differ on ties before it differed anywhere else — and the obvious hand-rolled version is dense ranking, which disagrees with this one the first time two reps tie. |
| **Milestones** | `spark` / `flame` / `deal` / `century` / `closer` | design shows First pitch · Triple digits · In the door · Full bundle · Clean sweep · Century | ⚠️ **UNBUILT, AND TWO ALREADY OVERLAP.** `spark` is *"First pitch scored"* and the design has *"First pitch"*. `century` is *"100 sessions"* and the design has *"Century — 100 scored pitches"*. Built fresh, a rep earns two First-pitch badges and two Centuries under different names. |
| **Strong threshold** | `STRONG_SESSION_THRESHOLD = 80`, fires a manager alert | 80 is the Strong band edge | ✅ same number, and now the same constant via `bands.ts`. |
| **Best pitch** | Arena shows `best` from the leaderboard row | design shows *"Best 106.5"* and *"Best Pitch award goes to the highest single score"* | ⚠️ **UNBUILT.** Different scales (0-100 vs 0-130), so the two "best" figures are not comparable and must not appear as one. |
| **Prize eligibility** | — | `PRIZE_ELIGIBLE_MIN_PITCHES = 5` counted pitches | ✅ no counterpart; no collision. |
| **Qualifying rule** | none — every scored session banks points | reached Discovery **and** 40+ base | ✅ no counterpart, but worth knowing: a pitch can bank gamification points and *not* count toward the Pitch Score board. |

## The rule this document exists to make cheap

> **Before wiring a Pitch Score number to a surface, ask: does the product already print this
> number? If yes, consume that authority or state in writing why a second one is correct.**

It takes about five minutes per number. The band collision took five minutes to find once the
question was asked, and it had already shipped onto a page.

## Why this keeps happening, stated plainly

Three duplicated decisions were found in one session — the manager predicate, a lowest-section
helper, and the bands. **All three agreed with their authority on the day they were written.**

That is what makes the class invisible. A duplicate is never wrong when you write it; it becomes
wrong later, or — as with the bands — it is wrong immediately in a way the tests do not reach,
because the cases you think to test are the cases where the copies agree.

Two were caught by looking around. One was caught by writing down what the previous look could
not see, and then going there. Only the third technique is repeatable, which is why this file is
a table rather than a lesson.
