---
started_at: 2026-11-26T08:10:00Z
trigger: Founder picker 2026-11-26 — score notes in erasure: "Blank the text" (docs/residuals/OPEN.md).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Legal erasure blanks typed score notes

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Legal erasure left typed score notes in place: a rep's dispute and a manager's answer (events by pitch subject, payload.note) and a score correction's required reason can quote the customer. The founder chose 'Blank the text' (picker 2026-11-26).",
    "how_this_build_will_embody_it": "rss_erase_sessions blanks those three, keeping the facts."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T11:14:48Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Holistic: every writer of a pitch-subject event was listed (two kinds) and every table with a typed reason on a score (pitch_score_overrides) — the class is 'text a person typed about an erased call's score'.",
    "how_this_build_will_embody_it": "Both reached; nothing else writes pitch-subject events."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Layer 2: after erasure, the dispute history still reads (who, when, the score) without the customer's words.",
    "how_this_build_will_embody_it": "Text → '[erased]'; the row stays."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Adjacent: the override reason column requires non-blank text, so 'blank' must keep the constraint.",
    "how_this_build_will_embody_it": "'[erased]' satisfies it."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "0366 applied in production; verify:live passed; the two statements exercised on production in a rolled-back transaction (2/2).",
    "how_this_build_will_embody_it": "db:verify, db:apply, the probe."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Erasure has one door (INVARIANT 38); this extends the same function, same caller.",
    "how_this_build_will_embody_it": "ERASURE_EXTENSIONS lists 0366 with why."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Append-only yields to erasure only (rss.erasure) — the one exception.",
    "how_this_build_will_embody_it": "Updates inside rss_erase_sessions only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Erasure must reach every stored copy of the customer's words and keep the non-personal facts.",
    "how_this_build_will_embody_it": "Notes and reasons blanked; dispute, author, time, score kept."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "The founder chose among three options in a picker.",
    "how_this_build_will_embody_it": "Built as chosen."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Checklist item 0: the decision came through a picker with a recommendation first.",
    "how_this_build_will_embody_it": "Recorded in OPEN.md."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The rule lives in the erasure function; the probe exercised it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T11:14:48Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
