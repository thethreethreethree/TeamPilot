---
started_at: 2026-11-24T21:31:28Z
trigger: Gong ledger F11.3 "Tracker scope and partial-call window" (P2, PARTIAL): no partial-call window.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Tracker window: only the first N minutes

## The record

keyword_trackers: name, phrases, side, kind (0276/0329), immutable by guard. matchTracker filters by side; hits carry
at_ms from spoken_at; smart hits too (0329).

## Outside view

Compliance trackers are about timing; a tracker that can't say "in the first two minutes" can't check a disclosure.

## Design

0335 within_first_seconds (30–3600, immutable). inWindow(); keyword matcher, smart scan, preview. Form: optional minutes.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Ledger F11.3: trackers can be scoped by side but not to a part of the call; a disclosure said at minute 20 counted the same as one in the first minute.",
    "how_this_build_will_embody_it": "An optional window applied by the one matcher (matchTracker) and the smart scanner."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T21:31:29Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Holistic: a tracker is read by the keyword scan, the smart scan, the preview, the list and adoption.",
    "how_this_build_will_embody_it": "Scan, smart scan and preview apply the window through inWindow(); the list shows 'first N min'; adoption counts the hits that exist."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Layer 2: a manager tracking a required disclosure needs 'said in time', not 'said at all'.",
    "how_this_build_will_embody_it": "Window field on the form with the example; preview uses it too."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Look past the task: a line with no time can't be shown to be inside the window.",
    "how_this_build_will_embody_it": "Left out of a windowed tracker and said on the form; trackers without a window are unchanged."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0335 applied and replayed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Whether a line is inside the window is decided once.",
    "how_this_build_will_embody_it": "inWindow() in trackers.ts, used by both scanners and the preview."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "A tracker never changes what it counts, so its past hits stay explainable.",
    "how_this_build_will_embody_it": "0335 adds within_first_seconds to the guard; replay shows a change is refused."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Honesty: an untimed line is not claimed to be in time.",
    "how_this_build_will_embody_it": "Untimed lines are left out of windowed trackers."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "DB check (30–3600 s) and guard; matcher, smart-scan and route tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T21:31:29Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
