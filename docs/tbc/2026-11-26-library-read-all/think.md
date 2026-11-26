---
started_at: 2026-11-26T01:31:01Z
trigger: Found while working on nested folders: GET /api/coach/remote/library read items with .limit(300) before taking out removals, and ignored the removals read's error.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The library reads every item

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Reading the library route for nested folders showed the item read capped at 300 before removals were taken out, and the removals read's error ignored.",
    "how_this_build_will_embody_it": "Every item is read, removals are checked (a failure is a 500), then the newest 300 remaining are shown."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:32:00Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Holistic: each shown item is signed for playback, so showing every item could mean thousands of signatures per load.",
    "how_this_build_will_embody_it": "The display stays at the newest 300; the page is told when there are more."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Layer 2/3: a library that silently drops its older calls looks complete and isn't.",
    "how_this_build_will_embody_it": "A sentence says how many are shown and that older ones are in Search."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Adjacent: the removals read ignored its error — a failure would show removed items as present.",
    "how_this_build_will_embody_it": "Its error is now a 500."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Whether an item is removed is the removals table's verdict; dropping it on a failed read re-decides it as 'not removed'.",
    "how_this_build_will_embody_it": "A failed read refuses to answer."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Items and removals are append-only; a removal is a row, and the view is derived from both.",
    "how_this_build_will_embody_it": "Read-only change; both are read completely."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Erased calls' items are handled by erasure, not by this read.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Say what's shown rather than imply it's everything.",
    "how_this_build_will_embody_it": "The truncated note."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests: removals before the cap; the truncated flag."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:32:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
