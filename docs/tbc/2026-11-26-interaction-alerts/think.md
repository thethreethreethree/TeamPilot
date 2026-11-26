---
started_at: 2026-11-26T04:09:00Z
trigger: Gong ledger F16.6 (P1, PARTIAL) — "filter recorded calls (no feedback, interaction alerts)"; the no-feedback list exists, interaction alerts do not.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Interaction alerts on calls not yet coached

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Gong's coaching list filters recorded calls by interaction alerts; ours lists a rep's uncoached calls with no way to see which ones are unusual, so a manager picks at random.",
    "how_this_build_will_embody_it": "Each uncoached call carries the interaction stats that are further out than 9 in 10 of this team's analyzed calls, and the list can be narrowed to those."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T04:11:50Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Holistic: the alerts come from the same calls the metrics route already chose (tree, team, hidden), so the alert can't point at a call the manager can't open.",
    "how_this_build_will_embody_it": "Stats are read only for those ids, in chunks of 150, paged by id."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Layer 3: the manager arrives from the by-rep table's 'not yet coached' count and leaves to a call; the alert must be in that list, not on another page.",
    "how_this_build_will_embody_it": "Chips and the filter live in the uncoached list; each row still goes to the call."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Adjacent: stats are versioned; an old transcript's numbers must not raise an alert.",
    "how_this_build_will_embody_it": "Newest transcript_version per call only (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "No outside configuration: session_interaction_stats is an existing table (0277).",
    "how_this_build_will_embody_it": "No outside config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Which calls are in scope is decided once in the route (tree, team, hides); the alerts consume that list.",
    "how_this_build_will_embody_it": "No second scope check."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Read path only; nothing is written.",
    "how_this_build_will_embody_it": "No new write path."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "No customer text: the alerts are numbers and fixed wording.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Guide, don't overtake: an alert says 'unusual for this team', never what the rep did wrong; the manager listens and decides.",
    "how_this_build_will_embody_it": "Wording 'further out than 9 in 10 of this team's calls — unusual, not necessarily wrong'."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "No fixed day-one behavior: a fixed 'talk ratio over 60%' line would claim knowledge of this team the system doesn't have.",
    "how_this_build_will_embody_it": "The cut is the team's own percentile; below 20 analyzed calls there are no alerts and the panel says how many more it needs."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "The 20-call minimum and the 9-in-10 cut follow the existing MIN_CLOSED-style rule and are recorded as a residual for the founder to adjust, not a new product decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: baseline minimum, percentile cut, current version, failed read as null, and the screen's wording."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T04:11:50Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
