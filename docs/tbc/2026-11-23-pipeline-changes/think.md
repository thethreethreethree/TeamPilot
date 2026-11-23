---
started_at: 2026-11-23T22:27:06Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F23.7 "…trends, changes… widgets" (LACK).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - What changed in the pipeline this week

## The record

- remote_prospect_events (0303, kinds widened by 0313/0320): stage {status,label}, amount, close_date, … with created_at.
- Forecast view shows totals and by-month; nothing shows movement.

## Outside view

A forecast says where the pipeline stands; a manager also needs what moved. The events already say.

## Design

pipelineChanges(events, from, to) + summarize; GET /api/coach/remote/prospects/changes; PipelineChanges card on
Forecast (this week / last week).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Understand before building: ledger F23.7 (LACK) — no 'changes' or trend widget; every prospect fact is an append-only event (0303) with its time, so a week's changes can be replayed from the record.",
    "how_this_build_will_embody_it": "Changes are derived from the events; nothing new is stored."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T22:29:09Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Layer 3: a manager's Monday question is 'what moved last week?' — wins, losses, slips — next to the forecast.",
    "how_this_build_will_embody_it": "A card under the forecast, this week / last week, each row opening its prospect."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Holistic: the card must follow 'Whose pipeline' and respect the reporting tree like every pipeline read.",
    "how_this_build_will_embody_it": "listProspects and the events are read through the caller's client; keyed by whose."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Look past the task: a prospect's creation writes several events at once; counting them as changes would inflate the week.",
    "how_this_build_will_embody_it": "Events within 5 seconds of a prospect's first are its creation; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "What counts as each kind of change is decided once.",
    "how_this_build_will_embody_it": "pipelineChanges.ts; the route and card only consume it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Changes are read from the append-only record, not stored again.",
    "how_this_build_will_embody_it": "Pure replay of events."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Erased prospects show as '(erased on request)'; no customer words added."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Guide, don't overtake: the card reports what happened; the manager decides what to do.",
    "how_this_build_will_embody_it": "A list and a headline; no automatic action."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Honesty: a failed or partial read must not read as a quiet week.",
    "how_this_build_will_embody_it": "A failed read (or a malformed reply) says it couldn't load; tested."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: a ledger LACK item built from existing records."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "pipelineChanges unit tests; route tests (bad period, failed reads); render test of the card."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T22:29:09Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
