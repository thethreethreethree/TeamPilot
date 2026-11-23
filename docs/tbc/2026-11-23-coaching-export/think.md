---
started_at: 2026-11-23T11:18:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F16.11 "Coaching export and monthly email" (LACK).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Coaching export

## The record

- /api/coach/remote/coaching-metrics: managers; D8-gated; per person feedbackGiven and callsListened over 30 days of
  coaching on calls from the last 180, tree-filtered.
- /api/coach/remote/search/export: CSV with recordAudit("session.export"); invariant: coach routes returning text/csv
  must record an audit row.
- toCsv neutralizes formula-leading cells (csvSafe).

## Outside view

An export that recomputes differs from the screen; one that skips the audit is an unlogged data exit; a name like
"=HYPERLINK(...)" runs in a spreadsheet.

## Design

?format=csv on the same route, after the D8 gate: person, feedback_given, calls_listened, period; audited; a
"Download CSV" link on the panel. The monthly email is filed (scheduling via the digest cron is its own build).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Understand before building: what the Coaching page already computes (feedback given, calls listened, D8 rules, tree filter) and how the call-search export audits a download were read first.",
    "how_this_build_will_embody_it": "The export is the same computation in a different format, audited the same way."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Layer 3: managers who review coaching outside the product need the numbers they see.",
    "how_this_build_will_embody_it": "'Download CSV' beside the coaching numbers."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Holistic: an export is data leaving the product; it must follow the same tree and audit rules as the screen.",
    "how_this_build_will_embody_it": "Same route, same tree filter; recordAudit session.export with the row count."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Look past the task: a person's name in a CSV can carry a spreadsheet formula.",
    "how_this_build_will_embody_it": "toCsv neutralizes it; tested with a name starting '='."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "External config can make an export silently incomplete.",
    "how_this_build_will_embody_it": "None; the monthly email part needs Postmark scheduling and is filed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "If the file and the screen computed coaching differently, they would disagree.",
    "how_this_build_will_embody_it": "The CSV is produced by the same route from the same maps as the panel."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Exports are facts about data leaving.",
    "how_this_build_will_embody_it": "Each download appends an audit row; nothing else is written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Erasure keeps non-personal facts.",
    "how_this_build_will_embody_it": "Coaching counts carry no customer words; not affected."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "A coaching export about managers should inform, not rank.",
    "how_this_build_will_embody_it": "Rows alphabetical by person."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Honesty: the export must not show numbers the screen wouldn't (D8 undecided → no numbers).",
    "how_this_build_will_embody_it": "The CSV branch sits after the D8 gate."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed; the monthly email schedule is filed for later."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Export shape, formula safety and audit are tested; the audit-route invariant also requires recordAudit."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T11:18:55Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
