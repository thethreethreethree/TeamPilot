---
started_at: 2026-11-23T22:30:26Z
trigger: OPEN.md forecast "no pipeline value trend over weeks and no stage funnel" (filed by docs/tbc/2026-11-23-pipeline-changes).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Pipeline value trend and stage funnel

## The record

- pipelineChanges.ts replays remote_prospect_events; the changes route already reads every visible prospect's events.

## Outside view

A trend is the same replay summed per week; a funnel is today's open deals per stage.

## Design

openValueAt(events, ends) and stageFunnel(prospects); the changes route adds `trend` for weeks=8; TrendStrip in the
changes card; StageFunnel in Forecast.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Understand before building: the pipeline-changes build left 'no value trend over weeks and no stage funnel'; the same events replayed to an instant give the open value then, and the prospects on screen give the funnel.",
    "how_this_build_will_embody_it": "openValueAt replays the record; stageFunnel counts current open deals; nothing stored."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T22:31:26Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Layer 3: 'is the pipeline growing?' and 'where do deals pile up?' belong next to the forecast.",
    "how_this_build_will_embody_it": "An 8-week bar strip in the changes card and an 'Open deals by stage' panel in Forecast."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Holistic: the card must follow 'Whose pipeline' and respect the reporting tree like every pipeline read.",
    "how_this_build_will_embody_it": "listProspects and the events are read through the caller's client; keyed by whose."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Look past the task: a deal later won or erased was open in earlier weeks; dropping it would rewrite history.",
    "how_this_build_will_embody_it": "Each week is replayed as of that week's end; tested with a deal won mid-period."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "The open value at an instant is computed once, from events, by one function.",
    "how_this_build_will_embody_it": "openValueAt in pipelineChanges.ts; the route returns its result; the strip only draws it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Changes are read from the append-only record, not stored again.",
    "how_this_build_will_embody_it": "Pure replay of events."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Erased prospects show as '(erased on request)'; no customer words added."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Guide, don't overtake: the card reports what happened; the manager decides what to do.",
    "how_this_build_will_embody_it": "A list and a headline; no automatic action."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Honesty: a bar for a week with deals but no amounts would look empty without saying why.",
    "how_this_build_will_embody_it": "Each bar's description says the deals open and how many have no amount."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: a ledger LACK item built from existing records."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "openValueAt/stageFunnel unit tests; route test for weeks=3; render test of the strip and funnel."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T22:31:26Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
