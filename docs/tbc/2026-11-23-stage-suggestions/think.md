---
started_at: 2026-11-23T21:58:34Z
trigger: OPEN.md stage-training "stage names are free text; a scenario's stage tag matches only the same name".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Suggest the stage names already in use

## The record

- Stage label: free text on the prospect card (0303); stage tags match on rss_stage_key (0310).
- TrainingManager's tag box already suggests stagesInUse; the card's stage box suggested nothing.

## Outside view

Most mismatches are spelling drift; suggesting the team's spelling fixes them without a list to maintain.

## Design

A "stage-names-in-use" datalist from stagesInUse(prospects) on the card's stage box (maxLength 60).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Understand before building: stage names are free text per prospect; stage tags match on a normalised key (case and spacing), so 'Demo' and 'Demo call' never match; the Training tag box already offers names in use, the prospect's stage box offered nothing.",
    "how_this_build_will_embody_it": "Offer the names already in use where the stage is typed, so reps converge on one spelling."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:59:25Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Layer 3: a rep typing a stage should be nudged to the name the team already uses, without a separate list to maintain.",
    "how_this_build_will_embody_it": "A suggestion list on the card's stage box, one spelling per name."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Holistic: the Training tag box and the stage-practice match both depend on the same names.",
    "how_this_build_will_embody_it": "stagesInUse (the helper the tag box already uses) feeds the card's suggestions."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Look past the task: a company stage list is a bigger change; suggestions fix most mismatches without one.",
    "how_this_build_will_embody_it": "No migration; the company-list option stays open in OPEN.md."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Which spelling represents a name is decided once.",
    "how_this_build_will_embody_it": "stagesInUse picks the most-used spelling per normalised name, for both boxes."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Suggestions don't change stored stages.",
    "how_this_build_will_embody_it": "Free text stays free; nothing rewritten."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Stage names name no customer."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Guide, don't overtake: suggest the team's spelling; the rep can still type their own.",
    "how_this_build_will_embody_it": "A datalist, not a forced choice."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Honesty: practice that silently doesn't appear because of a spelling is a hidden failure.",
    "how_this_build_will_embody_it": "Converging spellings makes the stage tags reach the prospects they were meant for."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: suggestions only; the company-list option (a decision) stays open."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Render test: one spelling per name, the most-used one."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:59:25Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
