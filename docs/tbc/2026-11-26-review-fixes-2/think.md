---
started_at: 2026-11-25T23:25:20Z
trigger: Independent review of b7b62095..145bb0c8 (26 Nov 2026): 7 findings, no leaks.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Fixes from the second 26 Nov review

## Design

KPI page: teamPick passed by saveQuota; loadTeam sequence guard; failed team load clears rows and shows why.
Coaching metrics lookback 180 → 210 days. Library: archivedFor paged; archived folders not suggested; restored note in
the call panel; empty folders archivable.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "A second independent review (26 Nov) of b7b62095..145bb0c8 found no access leak or missing column, but seven real defects: the KPI team view resetting or showing stale rows, a 180-day lookback biasing the coaching trend, a capped archive-event read, archived folders still suggested, and empty folders that couldn't be archived.",
    "how_this_build_will_embody_it": "Each fixed at its cause."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:25:21Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "Holistic: the KPI team table feeds the CSV export; a reset to everyone would export the company under a team's name.",
    "how_this_build_will_embody_it": "saveQuota keeps the chosen team."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "Layer 3: a failed team load must say so instead of showing the previous team's rows.",
    "how_this_build_will_embody_it": "Rows cleared and an error shown; a sequence guard drops stale responses."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "Look past the task: the archive read was the capped-read class this batch set out to remove.",
    "how_this_build_will_embody_it": "Paged."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "'Is this folder archived' stays one rule.",
    "how_this_build_will_embody_it": "archivedFolderIds over every event."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "A trend comparison must compare like with like from the same record.",
    "how_this_build_will_embody_it": "Lookback 210 days so both windows reach the same call ages."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "No personal data touched; erasure is unaffected by these read fixes.",
    "how_this_build_will_embody_it": "Read-path fixes only."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "Guide, don't overtake: a folder brought back by a save must be said, not done silently.",
    "how_this_build_will_embody_it": "The call panel says the folder was restored."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Two pickers answered this turn (AI reads follow the call; CSV removal stays manual)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Invariant 42 already guards paging; library tests page the events."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:25:21Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
