---
started_at: 2026-11-25T22:19:49Z
trigger: Gong ledger F11.5 "Start/end dates and backfill" (P2, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Tracker start and end dates

## Design

0344 keyword_trackers.starts_on / ends_on (check end ≥ start; frozen by the guard). trackerAppliesTo (UTC days) in
trackers.ts; both scans filter with it; the smart backfill list uses the same window. Form fields and list labels.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Ledger F11.5: a tracker can't be limited to a campaign's dates or scheduled; Gong trackers have start/end dates (past start backfills, future = scheduled, end pauses).",
    "how_this_build_will_embody_it": "Optional start and end dates on a tracker, honoured by both scans and the smart backfill."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:19:50Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Holistic: two scans (keyword, smart) and a backfill read trackers; all must agree on the dates.",
    "how_this_build_will_embody_it": "One rule, trackerAppliesTo, used by both scans; the backfill list filters the same window."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Layer 3/4: a manager needs to see that a tracker is scheduled or has ended, or its zero hits look like a bug.",
    "how_this_build_will_embody_it": "The list says 'scheduled from …', 'ended …', or the range."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Look past the task: a call with no known start can't be placed in a date window.",
    "how_this_build_will_embody_it": "A dated tracker leaves it out (tested); undated trackers behave as before."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "The feature depends on 0344 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0344; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Whether a tracker counts on a call must be one decision.",
    "how_this_build_will_embody_it": "trackerAppliesTo in trackers.ts; the backfill uses the same day boundaries (tested)."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Past hits must stay explainable; changing a tracker's dates would rewrite what it meant.",
    "how_this_build_will_embody_it": "The dates are frozen like the words (guard; replay: change refused, switching off allowed)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Erasure is unaffected: dates hold no personal data.",
    "how_this_build_will_embody_it": "No new personal data."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Guide, don't overtake: dates are the manager's choice.",
    "how_this_build_will_embody_it": "Optional fields; empty = as before."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; keyword backfill stays the existing 'scan recent calls' button (recorded)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "DB check + guard; rule, scan and route tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:19:50Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
