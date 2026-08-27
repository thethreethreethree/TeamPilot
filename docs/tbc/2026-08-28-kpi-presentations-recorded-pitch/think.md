---
started_at: 2026-08-28T06:10:00+08:00
---

# THINK — KPI accuracy: "presentations" = recorded pitches (Task 3, part 1)

## Why (the founder's report + the confirmed diagnosis)
The founder reported the KPI numbers are inaccurate (Coach Assessment card: "95 knocked · 46 presentations · 20 sold"
for Moses). I ran a live KPI audit (§1.2 retrospective, over the real `door_knocks` / `pitches` tables):

- **Data integrity is SOLID** — `rep_kpi_daily` (a view over `door_knocks`) matches raw exactly (Moses 95 = 95),
  and there are ZERO duplicate `client_knock_id` rows. Nothing is double-counted or stale at the source.
- **The real inaccuracy is "presentations."** The old formula `presentations = doors_knocked − no_answer` (46 for
  Moses) counts every non-no-answer knock — including 5 doors the rep logged an outcome for but never
  pitched-and-recorded. The actual RECORDED pitches (`pitches` rows) = **41**. So the card over-stated presentations.

I surfaced the definitional choice to the founder as a picker (§3.3 — the definition is a fact about *their*
business, not my call). The founder chose: **a presentation = a recorded pitch (41)**.

## The build (§1.5 organic + holistic — one source, traced consumers)
- `getAllTimeKpi` (all-time card / dashboard / door-log strip / rep self-view) and `getTodaysMetrics`
  (Macro "conversations" trio) both computed presentations as `knocked − no_answer`. Replace BOTH with a count
  of `pitches` rows. `pitches` is unique per `knock_id` (one pitch per door), so the row count = distinct doors
  actually pitched — exactly the founder's 41.
- All-time: a `count: exact, head: true` on `pitches` eq rep_id. Period (getTodaysMetrics): the same count scoped
  by the `door_knocks!inner(local_date)` join, mirroring the existing scores query's window — but WITHOUT the
  `status=complete` filter (scores gate on analyzed; a presentation is any recorded pitch, incl. ones that later
  failed to analyze).
- **§2.2 single-source**: presentations is now derived in ONE way (count pitches) in the doorlog data layer; every
  consumer already reads `.presentations` / `.conversations` off these two functions, so no consumer re-derives it.
- **Scope discipline (did NOT conflate two systems)**: the `/kpi` page's "Conversion rate = sold ÷ opportunities"
  runs on *coaching-session* rows (`compute.ts`), a DIFFERENT data source — the door presentations number does not
  feed it. So this change touches only the door-KPI presentations, not the session conversion rate.

## Gate (A30) + honesty (§3.4 / INV22)
A failed presentations count throws (never a fabricated 0). Verified LIVE against the real DB: Moses OLD 46 → NEW 41
(matches the founder's confirmed number), Johns 3 → 3, and the risky period-scoped embedded-inner head-count WORKS
via PostgREST (returned 41 for the 30d window — not the sandbox-unverifiable failure I guarded against).

## Session-read manifest (A22 — read_at ≥ started_at 06:10:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T06:11:00+08:00",
    "why_it_governs": "Understand WHY the number is wrong from the record before changing it.",
    "how_this_build_will_embody_it": "Ran a live audit; the root cause (non-no-answer knocks ≠ recorded pitches) is diagnosed, not guessed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T06:11:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-57", "read_at": "2026-08-28T06:11:08+08:00",
    "why_it_governs": "Retrospective identification — diagnose the wrong number from the actual record, not a forward theory.",
    "how_this_build_will_embody_it": "Audited live door_knocks/pitches; the 46-vs-41 gap is read off the real rows." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T06:11:10+08:00",
    "why_it_governs": "Organic + Holistic — trace every consumer of presentations before changing its source.",
    "how_this_build_will_embody_it": "Grepped all getAllTimeKpi/.presentations consumers; confirmed none re-derive it, and the /kpi conversion is a separate source." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T06:11:15+08:00",
    "why_it_governs": "Layer 2 — does the number actually match reality end-to-end, not just compile.",
    "how_this_build_will_embody_it": "Verified the new count against live data = the founder's confirmed 41." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T06:11:20+08:00",
    "why_it_governs": "THINK-first — audit the neighbours (other KPI denominators) before declaring accuracy fixed.",
    "how_this_build_will_embody_it": "Checked the /kpi conversion denominator is a separate system; scoped this fix to the door presentations only." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-309", "read_at": "2026-08-28T06:11:25+08:00",
    "why_it_governs": "Single-source the decision — presentations derived one way, consumed as a value, never re-computed downstream.",
    "how_this_build_will_embody_it": "The count lives in the doorlog data layer; every surface reads the returned value." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T06:11:30+08:00",
    "why_it_governs": "Guide-don't-overtake — the DEFINITION of a presentation is the founder's business fact.",
    "how_this_build_will_embody_it": "Surfaced the 3 candidate definitions as a picker; built the one (recorded pitch) the founder chose." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T06:11:35+08:00",
    "why_it_governs": "Honesty — a read failure must not become a fabricated 0 presentations.",
    "how_this_build_will_embody_it": "Both counts throw on error (INV22) so the surface degrades visibly, never to a false zero." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T06:11:40+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, surfaced the definition, traced consumers, verified live." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T06:11:45+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T06:11:50+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T06:11:55+08:00",
    "why_it_governs": "Gate the lesson — a KPI-accuracy fix must be verified, not asserted.",
    "how_this_build_will_embody_it": "Verified against the live DB (Moses 46→41 = the confirmed number); the honesty-throw is in code." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T06:12:00+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code, and the live-audit numbers." }
]
```
