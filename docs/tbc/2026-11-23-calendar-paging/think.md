---
started_at: 2026-11-23T21:26:27Z
trigger: OPEN.md calendar "calendar week read is capped at 500 calls".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Calendar reads the whole week

## The record

- calendar route: coaching_sessions .limit(500); remote_prospect_calls .in(all ids).

## Outside view

A silent cap is the shape that hides a busy week, however unlikely today.

## Design

fetchAllPagedResult for the week's calls; links read 100 ids at a time.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Understand before building: the calendar route read the week's calls with .limit(500) and their links in one .in() of every id.",
    "how_this_build_will_embody_it": "Page the calls (fetchAllPagedResult) and read links 100 ids at a time, the pattern used elsewhere."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:27:15Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Layer 2: a calendar that silently drops calls past 500 shows a busy team a quieter week than they had.",
    "how_this_build_will_embody_it": "Every call of the week is read."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Holistic: the held calls feed the same week as booked calls; the link read grows with them.",
    "how_this_build_will_embody_it": "Links read in groups of 100 so a big week doesn't build one oversized request."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Look past the task: the original note said 'far above any team's week today' — true, but a cap that fails silently is the failure shape, whatever the volume.",
    "how_this_build_will_embody_it": "No cap; a test proves 1,203 calls come back."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "A read helper decides paging once.",
    "how_this_build_will_embody_it": "fetchAllPagedResult, as Market and other routes use."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "The calendar is derived from the calls and bookings on record; reading more of them must not write anything back.",
    "how_this_build_will_embody_it": "No writes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Guide, don't overtake: the calendar shows what happened; it must not decide what to leave out.",
    "how_this_build_will_embody_it": "Nothing is dropped."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Honesty: a partial read shown as the whole week is a confident wrong answer.",
    "how_this_build_will_embody_it": "All rows, or a 500 if any page fails."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route test with 1,203 calls (all held calls returned; 13 link reads)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:27:15Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
