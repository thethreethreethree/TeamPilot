---
started_at: 2026-08-29T10:30:00+08:00
---

# THINK — roster-ordering completeness ("applies for ALL the system")

## Why (the founder's directive, verified exhaustively — not by assumption)
The founder's team-reorg directive was explicit: the org-hierarchy order "applies for ALL the system that
lives under Elostate." Stages 1-3 ordered the rosters I knew about; a §1.7 ground-up sweep of EVERY people/member
roster surface then found three still sorting alphabetically or by created_at — the surfaces the first pass missed.
This closes them, honoring the directive by measurement rather than by assumption.

## Understanding (the three gaps + one adjacent membership fix — §1.7 sweep, §1.5.2)
1. **Sales-Coach Coach-Assessment roster** (`coach-assessment/route.ts`) — sorted `agentName.localeCompare`, and
   the profiles select didn't even fetch `role`. Fix: select `role`, sort by `byOrgRank` via a `roleById` map (no
   response-shape change).
2. **C.A.R.E Coach-Assessment roster** (`careCoachAssessment.ts`) — both `withData` and `noData` sorted
   alphabetically; select had no `role`. Fix: select `role`, sort both by `byOrgRank`.
3. **`GET /api/team`** (`route.ts`) — the API twin of the already-migrated `fetchTeam`, still `.order("created_at")`.
   Fix: post-sort members by `byOrgRank` (role already selected). Settles the file-access + finance-cover pickers
   that read it.

§1.2 record-check (an audit finding is a SUSPECT, not a fix): the coach-assessment alphabetical sorts are a
DELIBERATE §A18 choice ("order implies nothing — not a leaderboard"). Org-hierarchy order is NOT a performance
grade, so it honors A18's "never grade-sorted" intent AND the founder's directive — compatible, so the fix is safe;
the §A18 comments are updated to say org-ordered-not-graded.

Adjacent (founder-approved via picker): the C.A.R.E coach roster's membership filter used the OLD admin set
`role.in.(CEO,COO,admin)` — a CFO coach would be silently excluded. Widened to include CFO, applying the founder's
existing CFO-is-C-Suite-admin decision consistently. This changes WHO appears (additive), so it was surfaced and
approved, not silently shipped.

## The build + gates (§1.5.2 THINK-first; A30 gate-the-lesson)
Three fixes above, all consuming the unit-tested `byOrgRank` primitive. Plus three order-REGRESSION guards
(fetchTeam, sales-coach team route, careCoachAssessment) — a silent removal of a `.sort(byOrgRank)` would otherwise
keep the suite green while reverting the founder's ordering; the guards make it fail instead. Proportionality
(don't-manufacture): three representative guards across both layers (data + route) exercising the identical primitive; two more
bespoke harnesses for the same one-line call would be noise, not coverage.

## Session-read manifest (A22 — read_at ≥ started_at 10:30:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-29T10:31:00+08:00",
    "why_it_governs": "Understand the gaps from the record (a sweep), not by theorizing — the fixes follow a measured finding.",
    "how_this_build_will_embody_it": "The three gaps came from a §1.7 ground-up sweep of every roster surface, not a guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-29T10:31:10+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md re-opened via Read this session; cited below." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T10:31:20+08:00",
    "why_it_governs": "Layer-2 effectivity — the rosters must ACTUALLY render in org order end-to-end, not just typecheck.",
    "how_this_build_will_embody_it": "Each fix sorts the real returned list; guards assert the actual output order." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-08-29T10:31:30+08:00",
    "why_it_governs": "Proactive THINK + search — sweep every adjacent roster surface, not only the ones first touched.",
    "how_this_build_will_embody_it": "A ground-up sweep found the three missed surfaces + the stale CFO membership filter." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-29T10:32:30+08:00",
    "why_it_governs": "Retrospective identification — check the record before 'fixing' the §A18 alphabetical convention.",
    "how_this_build_will_embody_it": "Confirmed the coach-assessment alphabetical sort was a deliberate A18 choice; org-order is compatible, not a regression." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-262", "read_at": "2026-08-29T10:32:40+08:00",
    "why_it_governs": "Ground-up audit in the outside-view stance — walk every roster surface, produce honest flags.",
    "how_this_build_will_embody_it": "The three gaps came from a §1.7 sweep of every people-roster surface, not from theorizing." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-08-29T10:32:50+08:00",
    "why_it_governs": "Leader-visibility label discipline — a roster surfaced to a manager must not read as a performance grade.",
    "how_this_build_will_embody_it": "Org rank is org-chart position, not a grade, so it honors A18's not-a-leaderboard intent while applying the founder's order." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-08-29T10:31:40+08:00",
    "why_it_governs": "Quick-decision checklist before a substantive action.",
    "how_this_build_will_embody_it": "Ran it: measured the gaps, record-checked the §A18 convention, surfaced the CFO membership change for approval." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-29T10:31:50+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-08-29T10:32:00+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a fresh read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-08-29T10:32:10+08:00",
    "why_it_governs": "Gate the lesson — a silent sort-drop must fail a test, not ship.",
    "how_this_build_will_embody_it": "Three order-regression guards assert the actual top-to-bottom order on representative rosters." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-29T10:32:20+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
