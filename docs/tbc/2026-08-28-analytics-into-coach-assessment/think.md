---
started_at: 2026-08-28T04:35:00+08:00
---

# THINK — merge Analytics into the Coach Assessment card (Task 2)

## Why (the founder's directive)
The founder asked to move the Analytics content into Coach Assessment, per-rep ("John Ramos's analytics attached to
John Ramos"), so a manager no longer goes to a separate Analytics page. I traced both pages (§1.5.2): the per-rep
DISTINCT Analytics content is the six per-skill /10 scores (`/skills` + `gradeSkill`); the team view is aggregate-only
(no per-person leaderboard). The catch (§1.5.1 layer 3): the Analytics page ALSO serves each rep's OWN self-view, while Coach Assessment is
manager-only — so a naive "remove Analytics" would strand reps. I surfaced the scope as a picker (§3.3); the founder
chose: merge the six scores into the card, hide the separate Analytics from MANAGERS, and keep reps' own Analytics.

## The build (§1.5 organic — reuse, minimal)
- `skills/route.ts` — a `scoresOnly=1` mode: returns the DETERMINISTIC six scores (aggregateSkills) with the band
  read, NO LLM breakdown pass. This matters for COST: the Coach Assessment auto-expands all rep cards (Expert), so
  fetching full `/skills` per rep would fire one LLM call per rep on every load — the scores don't need it; the full
  AI breakdowns stay on the rep's own Analytics self-view.
- `coach-assessment/page.tsx` — a lazy `SkillGrades` component (fetches `scoresOnly` when the card is expanded, so it
  never runs for a collapsed card) renders each rep's six scores under Doing Well / Coaching Focus. A failed read
  says so; not-enough-sessions is an honest empty.
- `managerNav.ts` + `SalesCoachShell.tsx` — a new `repOnly` nav flag (hidden from MANAGERS, the inverse of
  managerOnly). "Analytics" is now repOnly: managers see it merged on the assessment card, reps keep their own
  Analytics self-view (§1.5.1 layer 3 — nobody stranded).

## Gate (A30)
`managerNav` test: repOnly hides from a manager, keeps for a rep. The nav order drift-guard updated (order preserved;
its char bound relaxed for the new comment). `SkillGrades` render + the live skill display are founder visual-verify.

## Session-read manifest (A22 — read_at ≥ started_at 04:35:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T04:54:00+08:00",
    "why_it_governs": "Understand what Analytics actually contains before moving it.",
    "how_this_build_will_embody_it": "Traced both pages; the distinct per-rep content is the six skill scores." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T04:54:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (04:54)." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-28T04:54:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse /skills + gradeSkill + the existing card expand; trace the nav ripple.",
    "how_this_build_will_embody_it": "Reused the skills route (added a cheap mode) + the existing expand; the nav flag is a small shared addition." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-28T04:54:15+08:00",
    "why_it_governs": "Layer 2 (the card actually shows the scores) AND layer 3 (reps must not be stranded when Analytics moves).",
    "how_this_build_will_embody_it": "Skill scores render on the card; reps keep their own Analytics (repOnly), so both roles have a working destination." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "150-152", "read_at": "2026-08-28T04:54:20+08:00",
    "why_it_governs": "THINK-first — check what each page shows + the neighbors (the rep self-view) before moving content.",
    "how_this_build_will_embody_it": "Found the self-view dependency + the cost trap (per-rep LLM) before building." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T04:54:25+08:00",
    "why_it_governs": "Guide-don't-overtake — the merge scope + rep-view handling were the founder's decision.",
    "how_this_build_will_embody_it": "Surfaced the scope as a picker; built the option the founder chose." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T04:55:00+08:00",
    "why_it_governs": "Honesty — the card's skill section shows an honest error / not-enough-sessions empty, never a fabricated zero.",
    "how_this_build_will_embody_it": "SkillGrades distinguishes loading / failed / not-enough / scored; a failed read says so, not a zero." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T04:54:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood both pages, surfaced the scope, gated the nav rule, kept cost bounded." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T04:54:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T04:54:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T04:54:45+08:00",
    "why_it_governs": "Gate the lesson — the repOnly visibility rule is security-adjacent (it must not re-expose the wrong items).",
    "how_this_build_will_embody_it": "managerNav test locks repOnly-hides-from-manager + keeps-for-rep, both branches." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T04:54:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
