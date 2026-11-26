---
started_at: 2026-11-26T07:40:00Z
trigger: Residual R1 of docs/tbc/2026-11-26-review12-fixes — concurrent path saves could make a folder twice.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Folder path levels found or made in one statement

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Residual R1 of review 12: saving into a folder path found each level and made it if missing in separate requests, so two people saving into the same new path at the same moment could each make it.",
    "how_this_build_will_embody_it": "One database function finds or makes a level under the library's lock."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T10:25:34Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Holistic: the move and create guards already take the library lock (0363); the lookup must take the same one or the race stays open.",
    "how_this_build_will_embody_it": "rss_library_folder_find_or_create takes rss_folder_library_lock."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Layer 2: a duplicate folder splits a team's saved calls across two places with the same name.",
    "how_this_build_will_embody_it": "Made once."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Adjacent: the name rule (case, edge spaces) and the current-parent rule must match the move guard's.",
    "how_this_build_will_embody_it": "Same comparisons in SQL."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "0365 applied in production; verify:live passed; the function exercised in a rolled-back transaction (3/3).",
    "how_this_build_will_embody_it": "db:verify, db:apply, the probe."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Where a path level is is one verdict, computed in one statement.",
    "how_this_build_will_embody_it": "The route consumes the function's id."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Folders are still only inserted, never updated.",
    "how_this_build_will_embody_it": "Insert-only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a folder name is the saver's own text.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "The person names the folder; the system only avoids making it twice.",
    "how_this_build_will_embody_it": "No renaming."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The rule lives in the database function; route tests drive it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T10:25:34Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
