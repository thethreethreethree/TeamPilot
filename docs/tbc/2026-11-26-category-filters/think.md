---
started_at: 2026-11-26T08:35:00Z
trigger: Residual R1 of docs/tbc/2026-11-26-call-categories — no filters by category yet (ledger F10.9).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Filter Search and Team call stats by call category

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Residual R1 of the call-categories build: a call's category couldn't be used to find or compare calls; ledger F10.9 asks for a call-category filter on team stats.",
    "how_this_build_will_embody_it": "Search and Team call stats filter by a call's current category."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T11:42:13Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Holistic: a call moved from one category to another must count only in its current one, in every reader.",
    "how_this_build_will_embody_it": "Both filters use currentCategories over all picks of the calls."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Layer 3: the manager narrows the stats they already read, and finds the calls behind them, with the same choice.",
    "how_this_build_will_embody_it": "A Category select on both."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Adjacent: a failed category read must not show 'no calls'.",
    "how_this_build_will_embody_it": "Team stats: 500; Search: its error. The filter list hides on a failed list read; the stats still load."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "No migration and no outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "A call's category is one verdict (currentCategories), now read through one helper (categoriesOf) for team stats.",
    "how_this_build_will_embody_it": "No re-derived rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "State is derived by replaying events: a call's category is replayed from its append-only picks on every read, never stored as a column that could drift.",
    "how_this_build_will_embody_it": "No writes; both filters replay the picks."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; categories are company labels.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Filters narrow; they don't judge.",
    "how_this_build_will_embody_it": "No verdicts."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Built from the founder's category decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: a moved call left out of its old category; a failed read is a 500."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T11:42:13Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
