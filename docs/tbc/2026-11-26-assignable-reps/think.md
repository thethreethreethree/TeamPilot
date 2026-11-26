---
started_at: 2026-11-26T05:40:00Z
trigger: Residual R2 of docs/tbc/2026-11-26-review10-courses — the Assign pickers list the whole company.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Assign pickers list only reps the manager may assign

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Residual R2 of the course review: the Assign pickers (courses and scenarios) listed the whole company from /api/team, so a manager could pick reps the assign routes then refused.",
    "how_this_build_will_embody_it": "A picker roster that gives the same answer the assign routes do."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T05:55:52Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Holistic: two pickers shared the wide roster; fixing one would leave the other offering refusals.",
    "how_this_build_will_embody_it": "Both pickers use the new route."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Layer 3: a manager should only be offered choices that will work.",
    "how_this_build_will_embody_it": "Only tree-allowed, active people; never themself."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Adjacent: a failed tree check must not read as 'no team'.",
    "how_this_build_will_embody_it": "503 with a sentence; the picker's existing 'Couldn't load your team' line shows."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "No outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Who a manager may act on is the tree's verdict (rss_tree_filter); the roster consumes it, as the assign routes do.",
    "how_this_build_will_embody_it": "treeFilterRepsChecked, not a re-derived team."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Events are append-only and state is derived; a roster route must derive who is assignable from the tree each time, not store a team list that could go stale.",
    "how_this_build_will_embody_it": "No writes; the roster is computed per request from profiles and the tree."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; this reads staff names only.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "The manager picks; the system narrows only to what's allowed.",
    "how_this_build_will_embody_it": "No automatic picks."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route test: tree filter, no self, 503."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T05:55:52Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
