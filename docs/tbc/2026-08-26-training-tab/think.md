---
started_at: 2026-08-26T13:50:00+08:00
---

# THINK — Training tab (founder "build the Training tab next, defer practice engine" slice)

## The ask + the chosen slice
Founder (Moses, via picker): after the team feedback engine, "Build the Training tab next (defer practice engine)".
Founder's original words (John Knudtson feedback): a "Training" tab on the manager dashboard with per-rep + team
trainings, "accessible by the individual reps on their portal", with materials + exercises + AI-giving-feedback-as-reps-practice.
This slice builds the TAB + per-rep + rep-access parts from the coaching data we already have. The interactive
practice engine (materials / exercises / live AI practice feedback) is the founder-DEFERRED next slice — not built here.

## Understanding (reuse the data we already generate; role-branch, don't fork)
The trainings a rep needs are already computed: each Dissect yields growth areas + strategy gaps ("what to work on"),
already pooled per rep by the Coach Assessment engine and per team by the Team Training Brief engine (previous slice).
The Training tab is therefore a SURFACE over existing signal, not a new engine:
- Manager view = the team brief (shared `TeamTrainingBriefPanel`) + every rep's growth/strategy focuses (the
  coach-assessment route's `team[]`, already manager-gated).
- Rep view = that rep's OWN focuses only. A rep cannot read the team route (it's manager-gated, 403), so a new
  `my-training` route returns the CALLER's own aggregated focuses (self-data, no manager gate).

## The build (§1.5.1 layers 2 + 3 + 4)
- `my-training/route.ts` (NEW) — GET, any authenticated user, the caller's OWN `coach.dissect_generated` events
  aggregated via the existing `aggregateDissectContent` (growth/strategies/strengths) + best-effort door KPI.
- `TeamTrainingBriefPanel.tsx` (NEW shared component) — extracted the brief Build-button + `TeamBriefCard` out of the
  Coach Assessment page so the panel has ONE source used by both surfaces (no drift). Coach Assessment page refactored
  to render `<TeamTrainingBriefPanel />` in place of its inline copy.
- `training/page.tsx` (NEW) — role-branches: tries the manager team-read; on 403 falls back to the rep's own
  `my-training`. Manager sees the panel + per-rep trainings; a rep sees only their own. Honest empty states.
- Nav: a "Training" item in the Team Tools group (NOT managerOnly — the page role-branches so both roles land on a
  working destination; AMD-006 layer-3 continuity).

## Layer-3 workflow continuity (AMD-006, the reason nav gating matters)
A managerOnly nav item bounces a rep who clicks it (dead end). Training must be reachable by reps by design, so it is
NOT managerOnly; instead the DESTINATION adapts to the caller's role. Before the tab: manager and rep both read
coaching signal that had no single home. After: the manager has a meeting-prep surface, the rep has a self-serve
"what to work on" surface — each left in a flowing state, no bounce.

## §3.4 honesty
Every branch has an honest empty state: no dissects yet → "No trainings yet — they appear as sessions are coached",
never a fabricated list. The team brief panel keeps its own insufficient-signal state. `my-training` returns
`{degraded:true}` on a read error rather than a false-empty (error is not no-data).

## Ripple (holistic — §6 item 5)
- New route + new page + new shared component; the Coach Assessment page loses its inline brief copy (moved, not
  duplicated — drift removed). No schema change, no new engine, no new LLM call in this slice.
- The shared panel type-only-imports the engine result type (server-only module erased at build) — verified typecheck.
- Slice boundary held: NO materials/exercises/practice engine here (founder-deferred).

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 13:50:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-26T14:02:10+08:00",
    "why_it_governs": "Understand before building — know what a 'training' already is in our data before inventing a new one.",
    "how_this_build_will_embody_it": "The tab surfaces the growth/strategy signal we ALREADY compute; no new engine invented." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T14:02:12+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build (this manifest)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-137", "read_at": "2026-08-26T14:02:14+08:00",
    "why_it_governs": "Layers 2/3/4 — the tab must deliver useful trainings, keep BOTH roles in a flowing state, and read clearly.",
    "how_this_build_will_embody_it": "Role-branched destination (no rep bounce), honest empties, shared panel for a consistent surface." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-26T14:02:16+08:00",
    "why_it_governs": "THINK the surrounding constraints — a rep clicking a manager-only tab is the failure to pre-empt.",
    "how_this_build_will_embody_it": "Made Training non-managerOnly + role-adaptive rather than gating a rep out of their own trainings." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T14:02:18+08:00",
    "why_it_governs": "Honesty is the moat — no fabricated trainings.",
    "how_this_build_will_embody_it": "Every branch has an honest empty state; my-training returns degraded (not false-empty) on a read error." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-26T14:02:20+08:00",
    "why_it_governs": "Methodology in the working tree, consulted not cached.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build before writing." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-438", "read_at": "2026-08-26T14:02:22+08:00",
    "why_it_governs": "The quick-decision checklist — run before this substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood what a 'training' already is in our data, reused a tested pattern, honest empties, traced the rep-bounce ripple." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-597", "read_at": "2026-08-26T14:02:24+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at ≥ started_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T14:02:26+08:00",
    "why_it_governs": "Gate the lesson — a fix isn't done until a gate fails without cooperation.",
    "how_this_build_will_embody_it": "This slice adds no new pure logic to gate; it reuses the already-gated aggregation/engine, and typecheck guards the refactor (no dangling refs)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T14:02:28+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
