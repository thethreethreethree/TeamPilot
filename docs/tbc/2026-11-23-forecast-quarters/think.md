---
started_at: 2026-11-23T21:21:22Z
trigger: OPEN.md forecast "forecast by month only — no quarter view, no what-if".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Forecast by quarter

## The record

- dealRisk.forecastByMonth → past due, months, undated; ByCloseMonth renders it in Pipeline → Forecast.

## Outside view

Quarters are how a forecast is usually asked for; they are a sum of the month rows, nothing more.

## Design

dealRisk.byQuarter; a Months/Quarters switch on the table. The what-if half stays open.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Understand before building: forecastByMonth already gives month rows with value and expected; the residual asked for a quarter view summing them.",
    "how_this_build_will_embody_it": "Quarters are a sum of the same rows; no new data."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:22:02Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Layer 3: managers forecast by quarter; the same table should answer both questions.",
    "how_this_build_will_embody_it": "A Months/Quarters switch on the same table."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Holistic: the by-month table and the forecast cards share one win rate.",
    "how_this_build_will_embody_it": "byQuarter sums forecastByMonth rows; expected stays null where the months' is."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Look past the task: past-due deals must not be folded into the current quarter.",
    "how_this_build_will_embody_it": "Past due stays its own row in both views; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "One source for the numbers.",
    "how_this_build_will_embody_it": "byQuarter consumes forecastByMonth; it computes nothing of its own."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "A view of stored facts must not change them; quarters are a different grouping, not a different record.",
    "how_this_build_will_embody_it": "No data written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Guide, don't overtake: the rep's own expected dates drive the view; the system must not move or round them into a quarter.",
    "how_this_build_will_embody_it": "A view switch; the rep's dates are unchanged."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Honesty: a quarter total must not show an expected figure the months couldn't.",
    "how_this_build_will_embody_it": "Null stays null; '—' shown."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "byQuarter unit test (sums, null stays null); render test toggles to quarters with past due kept."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:22:02Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
