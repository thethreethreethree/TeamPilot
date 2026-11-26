---
started_at: 2026-11-26T03:24:45Z
trigger: Gong ledger F18.4 "Adoption over time and by team" (P3, PARTIAL) — no team-by-element adoption grid.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Message adoption by team

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "F18.4: the adoption board shows each message's share of calls overall and a per-tracker view by rep and week, but no grid by team; a manager with several teams can't see which team isn't saying it.",
    "how_this_build_will_embody_it": "A By team view on the same board: each message × each team, same rule."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T03:26:54Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Holistic: teams nest (a manager and everyone below), so a larger team includes the teams under it — a grid could double-count if read as a sum.",
    "how_this_build_will_embody_it": "The note under the grid says so; cells are rates, not counts to add."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Layer 3: the grid's message names open the same Adoption view as the list.",
    "how_this_build_will_embody_it": "Same onOpen."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Adjacent: the org chart is read with the service role; that must not widen what calls are counted.",
    "how_this_build_will_embody_it": "The service role reads only who reports to whom; calls and hits through the caller's client; teams limited by treeFilterRepsChecked."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "'Said it' is computeAdoption's verdict; the team view must not re-derive it.",
    "how_this_build_will_embody_it": "The same computeAdoption over each team's calls."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Derived on read from append-only hits and stats.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Rates and counts only; no customer text is returned.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "A view for coaching, not a ranking of managers.",
    "how_this_build_will_embody_it": "Teams in name order, no sort by rate."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests (per team; tree-limited; managers only) and a render test."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T03:26:54Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
