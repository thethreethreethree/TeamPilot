---
started_at: 2026-11-26T03:20:10Z
trigger: docs/tbc/2026-11-26-win-loss R1-mentions — win/loss by competitor or tracker mentioned.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Win and loss by what was said on the deal's calls

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "F20.10's remaining gap: Gong compares win rate when a competitor or tracker came up on the deal's calls vs not. Tracker hits exist per call; the pipeline list doesn't carry them.",
    "how_this_build_will_embody_it": "A mentions route (closed deals → their calls → hits → tracker names) and a mentioned/not table."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T03:22:49Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Holistic: adding hits to every pipeline load would slow every view; the breakdown is one panel.",
    "how_this_build_will_embody_it": "A separate route, fetched only when the Sources view shows win/loss."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Layer 2: an empty table on a failed read reads as 'nothing was said'.",
    "how_this_build_will_embody_it": "A failed read is a 500 and the panel says it couldn't load."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Adjacent: a deal's calls and their hits can be many; one .in() could outgrow the URL.",
    "how_this_build_will_embody_it": "Chunks of 150, paged by id."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Who may hear a call decides whose mentions count; the database's rules decide it.",
    "how_this_build_will_embody_it": "Every read through the caller's client (0276 tree, 0339 hides) — no service role."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Derived on read from append-only hits and links.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Tracker names are the company's words; no customer text is returned.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "A correlation for the team to think about, not a rule.",
    "how_this_build_will_embody_it": "Counts and rates side by side; no verdict."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "No instant results: a rate only where this team's own closed deals support it.",
    "how_this_build_will_embody_it": "MIN_CLOSED on each side."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Lib, route and render tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T03:22:49Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
