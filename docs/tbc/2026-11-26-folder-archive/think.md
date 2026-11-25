---
started_at: 2026-11-25T22:52:34Z
trigger: Gong ledger F12.6 "Folders with nesting and notes" (P2, PARTIAL): no archiving a folder.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Archive a library folder

## Design

0346 library_folder_events (archive/restore; append-only; read through the folder's rule). archivedFolderIds in
library.ts. Library GET: archived folders' items left out; folders returned with archived/canArchive. POST archive /
restore (owner or manager); add into an archived folder restores it. Library page: Archive per folder, Archived list.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Ledger F12.6: a library folder can't be put away; old folders crowd the list forever (Gong: archiving a folder leaves its calls searchable).",
    "how_this_build_will_embody_it": "Archive and restore a folder; its items leave the list, its calls stay in Search."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:52:35Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Holistic: the library route's add-by-name finds folders by name; an archived folder would become an invisible destination.",
    "how_this_build_will_embody_it": "Adding to an archived folder restores it and says so (tested)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Layer 3: an archived folder must be findable again or archiving is a dead end.",
    "how_this_build_will_embody_it": "An 'Archived folders' list with Restore under the library."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Look past the task: who may archive a company folder must match who may manage it.",
    "how_this_build_will_embody_it": "Personal: its owner; company: a manager (route checks; tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "The feature depends on 0346 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0346; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "'Is this folder archived' must be one rule.",
    "how_this_build_will_embody_it": "archivedFolderIds (latest event wins) used by GET and add."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Append-only: archiving must not delete the folder or its items.",
    "how_this_build_will_embody_it": "Events only; replay: update/delete refused."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Erasure of library items is unchanged.",
    "how_this_build_will_embody_it": "No change to library_items; events hold no call content."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Guide, don't overtake: the person chooses to archive.",
    "how_this_build_will_embody_it": "Manual; restorable."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; nesting recorded as not built."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Rule, route (permissions, restore-on-add) and GET tests; DB rules."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:52:35Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
