---
started_at: 2026-11-26T03:01:09Z
trigger: Gong ledger F20.10 "Win/loss analytics" (P3, PARTIAL) — no breakdown by contact count, deal size, competitors or tracker.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Win and loss by how deals ran

Timing note: work paused at 03:03 on the founder's stop and resumed on "continue"; the sections were printed at 2026-11-26T03:15:52Z.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "F20.10: the pipeline gives a close rate and a win rate by lead source, but nothing about how won deals ran differently from lost ones; each prospect already carries its call count and amount.",
    "how_this_build_will_embody_it": "Win/loss by number of calls and by deal size, from the prospects already loaded."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T03:15:52Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Holistic: the Sources view already computes a win rate client-side from the same list; a second definition would drift.",
    "how_this_build_will_embody_it": "Same rule — won ÷ (won + lost), closed only — in a pure, tested module."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Layer 2: a rate from two deals reads as a finding it isn't.",
    "how_this_build_will_embody_it": "No rate below 5 closed deals in a row; the row shows its counts and 'too few to read'."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Adjacent: fixed dollar bands would mean different things across companies.",
    "how_this_build_will_embody_it": "Deal-size bands are this pipeline's own thirds, with their ranges in the label."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Won/lost is the prospect's own stage verdict; the breakdown consumes it.",
    "how_this_build_will_embody_it": "Status from remote_prospects_current, unchanged."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Derived on read from the prospect view, which is itself derived from append-only events.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Counts and amounts only; no customer text is shown.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "A pattern for the team to read, not a verdict on a rep.",
    "how_this_build_will_embody_it": "Pipeline-level counts; no per-rep ranking."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "No instant results: the breakdown shows nothing it can't support from this team's own closed deals.",
    "how_this_build_will_embody_it": "The MIN_CLOSED floor, and thirds of this pipeline's own amounts."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Lib tests for the floor and bands; a render test for the tables."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T03:15:52Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
