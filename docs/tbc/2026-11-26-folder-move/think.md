---
started_at: 2026-11-26T06:00:00Z
trigger: Gong ledger F12.6 (P2, PARTIAL) — "a folder can't be moved after it's made".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Moving a library folder

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Ledger F12.6: a library folder couldn't be moved after it was made (0353 fixed the parent at creation because folders are never updated), so a mis-filed folder could only be rebuilt by hand.",
    "how_this_build_will_embody_it": "A move is an event; the current parent is derived from the latest move."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T09:24:01Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Holistic: four readers used the made-with parent (paths, archive-inside, save-by-path, the ancestor walk) and the 0353 create guard counted depth by it; archive state took the latest event of ANY kind, so a move after an archive would have un-archived the folder.",
    "how_this_build_will_embody_it": "All read library_folders_current; the create guard walks current parents; archivedFolderIds counts archive/restore only (tested)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Layer 3: the manager moves a folder from its own header and sees the library re-sorted; a refused move says why.",
    "how_this_build_will_embody_it": "'Move…' on the header; the database's sentence is shown."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Adjacent: a loop (a folder into something inside it) or a fourth level must be impossible, not just discouraged.",
    "how_this_build_will_embody_it": "A trigger on the move event refuses both; exercised on production Postgres in a rolled-back transaction (8/8)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "0360 is applied in production; the old kind check name was confirmed live before the apply and gone after; verify:live passed.",
    "how_this_build_will_embody_it": "db:verify, constraint probe, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "A folder's current parent is one verdict (rss_folder_parent_now, through the view); no reader re-derives it from the events.",
    "how_this_build_will_embody_it": "Every reader uses library_folders_current."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Folders are never updated; a move must be an appended event, not an edit to parent_id.",
    "how_this_build_will_embody_it": "library_folder_events kind 'move' with to_parent."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a move stores folder ids only.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "The person who may archive a folder decides where it goes; nothing moves on its own.",
    "how_this_build_will_embody_it": "Same permission as archive."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision: moves follow archive's permission."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The guard is in the database; tests for archive-after-move, the move action and the screen's choices."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T09:24:01Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
