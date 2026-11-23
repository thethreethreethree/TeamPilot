---
started_at: 2026-11-23T08:21:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, forecast risk scoring and scenario planning (gong.io capture M36, graded LACK: "Pipeline totals only; no sales forecast, risk score or what-if").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Deal risk and forecast

## The record

- The pipeline (listProspects → remote_prospects_current + to-dos) holds per prospect: status, amount, next call date,
  last call, created date, open to-dos with due dates. Totals per status exist (pipelineTotals); nothing flags a deal
  or forecasts.
- Gong's capture: deal warnings (no next meeting, long negotiation) and forecast risk scoring with scenario planning.

## Outside view

A risk score that is an opaque number invites trust it hasn't earned; a forecast computed from no history is a
day-one claim the constitution forbids; a missing amount silently counted as zero understates the pipeline.

## Design

1. dealRisk(): reasons from facts — no next call, booked date passed without a call, 21 days quiet (14 for a new
   prospect with no call), overdue to-do; no amount shown but not counted toward risk. Two reasons = at risk; one = watch.
2. forecast(): open value; expected = open × this pipeline's win rate once 5 deals have closed; what-if without the
   at-risk deals; unpriced deals counted.
3. UI: a reasons line on list rows; Pipeline → Forecast with three numbers and the at-risk list.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Understand before building: what the pipeline already knows per prospect (next call, last call, to-dos, amount, status) and what the capture means by forecast risk were read first.",
    "how_this_build_will_embody_it": "Every flag is computed from those fields; nothing new is collected."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Layer 3: a warning must lead to the deal and to a fix the rep can make.",
    "how_this_build_will_embody_it": "Each reason is an action (book the next call, call back, finish the to-do); at-risk deals open their prospect."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Holistic: the Pipeline page now has four views and every list row a new line.",
    "how_this_build_will_embody_it": "The list, Calendar, Sources and Ask box are unchanged; risk reuses goTo() to open a prospect on its tab."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Look past the task: a forecast number is the easiest place to fake understanding.",
    "how_this_build_will_embody_it": "The expected value refuses to appear before 5 closed deals; amounts missing are counted and named, not silently zero."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "External config can make a feature silently incomplete.",
    "how_this_build_will_embody_it": "None here: no migration, env key or dashboard setting; computed in the browser from the pipeline read."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "One rule decides 'at risk' for every surface.",
    "how_this_build_will_embody_it": "dealRisk() in dealRisk.ts is used by the list rows and the Forecast view; forecast() reuses it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Derived state must come from the record, not be stored and drift.",
    "how_this_build_will_embody_it": "Risk and forecast are computed on read from remote_prospects_current; nothing is written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched: nothing is stored."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Guide, don't overtake: the product points at facts; the rep decides what to do.",
    "how_this_build_will_embody_it": "Reasons are stated as checks; no automatic action or AI judgement."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "No fixed day-one behavior: a forecast from no history would be a claim the product cannot make.",
    "how_this_build_will_embody_it": "'Not yet — needs 5 closed deals' until this pipeline's own win rate exists; the footer says these are checks, not predictions."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No founder decision needed: thresholds are stated on screen and filed for review."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Every rule and the no-forecast-before-5 rule are tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T08:24:17Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  },
  {
    "id": "§4",
    "source_file": "CLAUDE.md",
    "line_range": "414-428",
    "read_at": "2026-11-23T08:25:21Z",
    "why_it_governs": "Changing the risk thresholds later is a method change; it counts as learning only when measured against the alternative on real outcomes.",
    "how_this_build_will_embody_it": "The thresholds are filed as unmeasured; the residual says to compare flagged-vs-lost deals before adjusting them."
  }
]
```
