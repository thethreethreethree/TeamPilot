---
started_at: 2026-11-26T06:55:00Z
trigger: Residual R2 of docs/tbc/2026-11-26-review11-fixes — assign routes accepted a removed person.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Training is only assigned to active people

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Residual R2 of review 11: the assign routes (practice scenarios, courses) accepted a removed person when called directly; only the picker left them out.",
    "how_this_build_will_embody_it": "Both routes require status = active, the same rule the picker's roster uses."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T09:53:17Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Holistic: two assign routes share the rule; fixing one would leave the other open.",
    "how_this_build_will_embody_it": "Both changed."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Layer 2: training given to someone who has left is work nobody will do and a number that never moves.",
    "how_this_build_will_embody_it": "Refused with the existing 'None of those reps are on your team.'"
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Adjacent: the roster route already filters active people.",
    "how_this_build_will_embody_it": "Same rule in all three."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "No outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Who may be assigned is one rule; the roster and the routes now agree.",
    "how_this_build_will_embody_it": "status = active in each."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Events are append-only and state is derived; refusing an insert changes no history.",
    "how_this_build_will_embody_it": "No rows edited."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; this stores nothing new.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "The manager still chooses; the route only refuses what can't work.",
    "how_this_build_will_embody_it": "No automatic picks."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A route test for an inactive person."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T09:53:17Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
