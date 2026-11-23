---
started_at: 2026-11-23T21:52:25Z
trigger: OPEN.md stage-training '"rep needs" not yet used — the stage's scenarios are not ranked by the rep's weakest rubric items'.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Rank stage practice by what the rep misses

## The record

- 0310: scenarios tagged with stages; stage-practice lists them on a prospect.
- training_scenarios.focus is free text; pitch_score_elements holds hit/partial/missed per rubric item per call.
- REMOTE_RUBRIC.elements: the phone & video rubric's items (ids like "intro.reasonForCall").

## Outside view

"Rep needs" only means something if a scenario is known to train a specific item. Tag it explicitly; rank from the
rep's own recent grades; say why.

## Design

0326 training_scenario_elements (+ current view). repNeeds.ts: missRates (miss 1, partial ½, ≥3 grades), rankByNeeds.
stage-practice GET ranks for the prospect's rep (last 10 scored phone/video calls). TrainingManager "Trains:" chips +
"+ Rubric item". Prospect card shows the reason.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Understand before building: a scenario's focus is free text with no link to the rubric; per-call grades exist per rubric item (pitch_score_elements); ranking by word overlap would be a guess presented as a recommendation.",
    "how_this_build_will_embody_it": "An explicit tag from a scenario to the rubric items it trains, and ranking only by those tags."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:57:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Layer 3: a rep at the Demo stage with five scenarios should see the one that fixes what they keep missing first, and why.",
    "how_this_build_will_embody_it": "Ranked on the prospect card with 'Trains X — missed on N of the last M scored calls'."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Holistic: stage practice is read by the rep and by managers viewing a report's prospect; the tag table must behave like 0310's stage tags.",
    "how_this_build_will_embody_it": "Same append-only event shape, view and manager route; the ranking reads through the caller's client."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Look past the task: a failure to read needs must not hide practice.",
    "how_this_build_will_embody_it": "Ranking is best-effort: any failed read keeps the list in its order with no needs; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0326 applied to production; live checks re-run."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "What counts as a need is decided once.",
    "how_this_build_will_embody_it": "repNeeds.ts (missRates, rankByNeeds); the route and screen only consume it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Tags change over time and must keep their history.",
    "how_this_build_will_embody_it": "Tag and untag are rows; the current set is a view."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Tags hold rubric ids only — no customer words."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Guide, don't overtake: the rep still chooses which practice to start; the ranking only orders and explains.",
    "how_this_build_will_embody_it": "Order plus a stated reason; every scenario stays on the list."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Honesty: two calls are not a pattern; a ranking from too few grades would claim knowledge the data lacks.",
    "how_this_build_will_embody_it": "An item needs at least 3 grades (MIN_GRADED); untagged scenarios aren't guessed at."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build; the tag design copies 0310."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "repNeeds unit tests; route tests (ranking, failed read keeps order, tag route refuses made-up items); render test; PGlite replay."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:57:03Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
