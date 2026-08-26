---
started_at: 2026-08-27T05:15:00+08:00
---

# THINK — Practice analytics (founder pick "Build practice analytics")

## The ask + the §A18 decision the founder made
Founder chose to build practice analytics, then answered the §A18 framing picker with "closest to the instruction from
the feedback." The original John Knudtson feedback wanted the MANAGER to have per-rep signal to coach from in the team
meeting. So the manager sees each rep's practice ACTIVITY + GROWTH DIRECTION over time (to coach from), rendered
UNRANKED — never a score leaderboard. The rep sees their own per-skill trend on their portal.

## Understanding (reuse the immutable events store — §3.1, no new table)
The practice engine (roleplay ?focus=) was stateless by design. The ONE durable thing analytics needs is a record of
each scored attempt. §3.1: everything is an append-only EVENT; state is derived by replaying. So a scored practice
attempt becomes a `coach.practice_scored` event (mirrors salesDissect's `coach.dissect_generated` insert exactly),
and every read DERIVES the trend by replaying a rep's events. No new table, no mutation.

## §1.5.3 precondition — VERIFIED, not assumed
The write depends on the events schema accepting a new kind. Checked against migration 0004_events.sql: `kind text
not null` (NO check constraint; many `coach.*` kinds already write there), `subject text not null` (I set
`practice:<repId>`), `actor` FKs auth.users (a real rep id), payload jsonb. The admin/service-role client bypasses the
RLS with-check (as salesDissect already does). So the append lands — the §1.5.3 "config/schema the feature depends on"
is confirmed working, not hoped.

## The build (§1.5.1 layers 2 + 4)
- `practiceAnalytics.ts` — the write (`recordPracticeScore`, best-effort append) + the reads (`aggregateRepPractice`
  → the rep's per-skill trend; `summarizePracticeForManager` → activity + growth direction only). Trend = first→latest
  APPLIED score, ±6 threshold (up/flat/down). §3.4: honest empty (null latest/trend) when unpracticed; applied:false
  is activity with no score.
- Roleplay route (scored branch) appends the event via `after()` (survives the serverless response — the dropped-write
  lesson). No change to the default path.
- my-training returns the rep's own `practice` summary; coach-assessment's team[] gains a per-rep `practice` summary.
- Training tab: rep sees "Your practice" (per-skill latest + trend); manager per-rep card shows an UNRANKED activity +
  growth line (§A18). A trend chip is a DIRECTION (improving/holding/slipping), not a rank.

## §A18 — the label is the defense
The manager summary exposes ONLY {attempts, latest, trend} — no per-focus score list leaks; rendered alphabetical
(reusing the existing team sort), framed "practice · growth over time", never sorted by score. A test asserts the
manager summary carries no per-focus detail.

## Ripple (§6 item 5)
- New module + one event kind + reads bolted onto two existing routes + UI on the Training tab. No migration, no
  schema change, no new route, default roleplay path untouched. Append-only (§3.1) — no update/delete.

## Gate the lesson (A30)
The honesty seams (honest-empty, applied:false-has-no-score, trend threshold, clamp, manager-summary-hides-detail) are
unit-locked so a regression fails a test, not just prose.

## Session-read manifest (A22 — read_at ≥ started_at 05:15:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T05:20:02+08:00",
    "why_it_governs": "Understand the store + the founder's decision before building.",
    "how_this_build_will_embody_it": "Reused the events store per §3.1; built exactly the §A18 framing the founder chose." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T05:20:04+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read this build (this manifest)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-87", "read_at": "2026-08-27T05:20:06+08:00",
    "why_it_governs": "Layers 2 + 4 — analytics must deliver a real, useful trend AND read clearly.",
    "how_this_build_will_embody_it": "Real derived trend from replayed events; clear rep + manager surfaces with honest empties." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-163", "read_at": "2026-08-27T05:20:08+08:00",
    "why_it_governs": "THINK the surrounding constraint — a leader-visible score is a ranking risk.",
    "how_this_build_will_embody_it": "Manager sees growth DIRECTION unranked (§A18), not a scoreboard; verified the write precondition proactively." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-176", "read_at": "2026-08-27T05:20:10+08:00",
    "why_it_governs": "The write depends on the events schema accepting a new kind.",
    "how_this_build_will_embody_it": "Checked 0004_events.sql: no kind CHECK, subject non-null set, admin bypasses RLS — the append lands." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-08-27T05:20:12+08:00",
    "why_it_governs": "Events are immutable; state is derived by replay.",
    "how_this_build_will_embody_it": "A scored attempt is an append-only event; trends are DERIVED by replaying, never a mutable counter." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T05:20:14+08:00",
    "why_it_governs": "A trend must never fabricate a score or a direction a rep didn't earn; an unpracticed rep must read as honestly empty, not as a zero.",
    "how_this_build_will_embody_it": "Honest empty (null) when unpracticed; applied:false is activity with no score; trend null under 2 points." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T05:20:16+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the store, reused it, verified the precondition, honest states, gated the lesson." },
  { "id": "§A18", "source_file": "ThinkerThinker.md", "line_range": "431-432", "read_at": "2026-08-27T05:20:18+08:00",
    "why_it_governs": "Surfacing behaviour data to a leader — the label is the defense.",
    "how_this_build_will_embody_it": "Manager summary = activity + growth direction only, unranked; no per-focus scores leak; a test asserts it." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T05:20:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T05:20:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T05:20:24+08:00",
    "why_it_governs": "The honesty + §A18 rules here would silently rot in prose unless a test fails when they regress; the lesson must live in a gate, not a comment.",
    "how_this_build_will_embody_it": "9 unit tests lock the aggregation honesty seams (empty, applied-no-score, threshold, clamp, manager-hides-detail)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T05:20:26+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
