---
started_at: 2026-11-23T09:05:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, AI prompt library (gong.io capture M36 "Library of 40+ revenue prompts", graded LACK).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Ask Coach prompt library

## The record

- Two Ask boxes: Ask Coach on a call (SessionCoachTools AskCoachPanel → /api/coach/remote/ask, 3-2000 characters,
  the call's transcript, score and coaching) and Ask about this pipeline (RemotePipeline AskPipeline →
  /api/coach/remote/ask-pipeline, 3-1000, pipeline facts, risk and latest briefs). The pipeline box had three starters.
- The capture lists ~45 named prompts (many graded COVERED because Ask Coach can answer them); the library itself is LACK.

## Outside view

A library fails if its prompts ask for data the box doesn't have (the AI then improvises), if it sends questions on the
person's behalf, or if it copies another product's text.

## Design

promptLibrary.ts — our own prompts for "call" (Coach me / Read the buyer / After the call) and "pipeline" (This week /
Patterns / Report); PromptLibrary.tsx — collapsed list under each box; picking fills the input.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Understand before building: what each Ask box actually reads (one call's transcript and score; the pipeline's facts, risk and latest call summaries) was read first.",
    "how_this_build_will_embody_it": "Each prompt asks only for what its box's data holds; a test keeps call prompts from promising CRM, email or other deals."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Layer 3: a ready prompt must land where the person can still change it.",
    "how_this_build_will_embody_it": "Picking fills the box and closes the list; the person presses Ask."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Holistic: both Ask boxes are reused, not changed.",
    "how_this_build_will_embody_it": "The library only fills the existing input; the routes, limits and answers are unchanged."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Look past the task: copied wording would recreate another product's content.",
    "how_this_build_will_embody_it": "The prompts are our own, written for ELOSTATE's data and module names."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "External config can leave a feature silently incomplete.",
    "how_this_build_will_embody_it": "None: static prompts in the bundle; the AI provider is the one the Ask boxes already use."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "One list per box, read by its box only.",
    "how_this_build_will_embody_it": "promptLibrary.ts is the single source; PromptLibrary.tsx renders it for either scope."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "A question asked from the library is still an asset on the record; the library must not add a second, unrecorded way to ask.",
    "how_this_build_will_embody_it": "Nothing new is stored; an asked question is saved as Ask Coach already saves it."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "The System asks the human first and does not take over the question.",
    "how_this_build_will_embody_it": "Prompts never send themselves; the person edits and asks."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Honesty: a prompt must not imply analysis the data can't support.",
    "how_this_build_will_embody_it": "Several prompts ask the coach to say when something is unknown or the numbers are too small to judge."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Length limits, unique ids and the call-scope wording rule are tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T09:08:13Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
