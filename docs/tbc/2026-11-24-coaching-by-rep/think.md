---
started_at: 2026-11-24T20:32:55Z
trigger: Gong ledger F16.5 "Coaching inbox" (P1, PARTIAL): per request, not one row per rep with last feedback and 30-day overdue.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Coaching by rep

## The record

- /api/coach/remote/coaching-metrics loads 180 days of the manager's visible phone/video calls and their coaching
  events; counts feedback per manager by D8 (countsAsFeedback) in the last 30 days.
- The inbox decides open requests with isRequestOpen over the same events.

## Outside view

Totals per manager say how much coaching happened, not who is missing it; that is the question a manager opens the
page with.

## Design

feedback.ts coachingByRep (pure): per rep — feedback30, lastFeedbackAt, overdue (calls in 30 days and no feedback),
openRequests, calls30, callsWithoutFeedback30; sorted overdue → least feedback → name. Route returns byRep; Coaching
shows "Your reps, last 30 days".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Ledger F16.5: Gong's inbox is one row per direct report (last feedback, 30-day overdue, open requests, recorded calls); ours is one row per request plus per-manager totals — a manager can't see which rep is going uncoached.",
    "how_this_build_will_embody_it": "Rows built from the records already loaded for the per-manager numbers."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:32:56Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Holistic: the per-manager metrics, the CSV export and the inbox all read the same coaching events under D8.",
    "how_this_build_will_embody_it": "byRep comes from the same route, events and countsAsFeedback; isRequestOpen decides open requests exactly as the inbox does."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Layer 3: a manager opens Coaching to decide whom to coach next.",
    "how_this_build_will_embody_it": "Overdue reps first, then least feedback; each row says last feedback, open requests and calls not yet coached."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Look past the task: a rep with no calls isn't overdue, and a manager's own calls aren't a rep's row.",
    "how_this_build_will_embody_it": "Overdue needs calls in 30 days; the manager is excluded; both tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "What counts as feedback (D8) and whether a request is answered are decided once (countsAsFeedback, isRequestOpen).",
    "how_this_build_will_embody_it": "coachingByRep calls both; nothing re-derives them."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Honesty: a failed read is never 'no coaching'.",
    "how_this_build_will_embody_it": "Name or request read failures answer 500, like the rest of the route."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: D8 already decided what counts; the ledger item names the columns."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "feedback.test.ts pins the D8 rule per rep, overdue and sort; the route test pins the wiring; the render test pins the table."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:32:56Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
