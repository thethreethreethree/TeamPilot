---
started_at: 2026-11-26T02:27:37Z
trigger: Gong ledger F12.9 "Folder usage report" (P3, PARTIAL) — no per-folder usage report.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Folder usage: who on the team has played each call

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "F12.9: a manager puts calls in front of the team but can't tell whether anyone listened. listen_events already records every stretch played.",
    "how_this_build_will_embody_it": "A per-item count of distinct listeners (not the rep), from those events."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T02:28:12Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Holistic: listen_events grows with every play; the read must be bounded and not slow the library for everyone.",
    "how_this_build_will_embody_it": "Read only for managers in the company library, only for the shown items, paged and chunked."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Layer 2: a count that silently reads 0 on a failed read would mislead the manager about their team.",
    "how_this_build_will_embody_it": "A failed read leaves the counts out (null), never 0."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Adjacent: a rep replaying their own call isn't the team hearing it.",
    "how_this_build_will_embody_it": "The rep's own plays are excluded; repeat plays count once."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Who listened is listen_events' record; the count consumes it as stored.",
    "how_this_build_will_embody_it": "Distinct listener ids per session, nothing inferred."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "listen_events are append-only; the count is derived on read.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Counts only — no customer text and no names are shown.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "A count of who heard it, not who didn't — no naming, no ranking of teammates.",
    "how_this_build_will_embody_it": "'Played by N teammates' only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A route test: rep excluded, repeats once, peers get no count."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T02:28:12Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
