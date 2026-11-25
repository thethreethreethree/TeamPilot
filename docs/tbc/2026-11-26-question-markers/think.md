---
started_at: 2026-11-25T23:48:34Z
trigger: Gong ledger F9.6 "Call info and points of interest" (P2, PARTIAL): no question markers.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The rep's questions on the call page

## Design

questionMarkers(segments) in stats.ts (isQuestion, rep lines, start time). The stats route returns `questions`;
RemoteCallPanel shows "Questions asked by the rep (N)" with times that seek the player (full page only).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Ledger F9.6: the call page counts the rep's questions (Questions / hour) but never shows which questions or when; Gong marks questions asked on the timeline.",
    "how_this_build_will_embody_it": "A list of the rep's questions with their times, each playing the call from that moment."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:48:35Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Holistic: the stats route already reads the call's timing through the caller's client; a second read would duplicate access logic.",
    "how_this_build_will_embody_it": "Markers computed from the same timing in the same route."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Layer 3: a count with no way to the moments is a dead end for coaching.",
    "how_this_build_will_embody_it": "Each question is a button that seeks the player."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Look past the task: Macro Mode shows only the PDF's elements.",
    "how_this_build_will_embody_it": "The list is on the full page only (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "'Is this a question' is decided by isQuestion, which the question rate uses.",
    "how_this_build_will_embody_it": "questionMarkers uses the same isQuestion; a test checks the list agrees with the rate."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Derived from the transcript on read; nothing stored.",
    "how_this_build_will_embody_it": "No new table."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Erasure removes transcript lines; markers are derived from them, so nothing survives.",
    "how_this_build_will_embody_it": "Computed on read."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Guide, don't overtake: show the rep's questions, not a verdict on them.",
    "how_this_build_will_embody_it": "A plain list; no score."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Lib, route and render tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:48:35Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
