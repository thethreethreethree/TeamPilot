---
started_at: 2026-11-23T11:21:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F16.12 "Coaching routines" (LACK).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The manager's weekly coaching routine

## The record

- Manager queues already on Remote Sales → Coaching: coaching inbox (items[].open), score disputes (open by default,
  ?module=remote_sales), unscored backlog (?module=remote_sales → unscored), and Training assignments (?team=1 →
  state "overdue").

## Outside view

A routine of generic advice is noise; one that shows a tick when its count failed to load is worse.

## Design

routine.ts routineSteps (todo/done/unknown with counts and links); WeeklyRoutine at the top of Coaching; anchors on the
sections it links to.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Understand before building: which coaching queues already exist and what each route returns (inbox open flag, open disputes, unscored count, overdue assignments) was read first.",
    "how_this_build_will_embody_it": "The routine only counts those; no new data."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Layer 3: a routine should take the manager straight to the work.",
    "how_this_build_will_embody_it": "Each to-do links to its section or to Training."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Holistic: the routine reuses four manager routes; it must not change them.",
    "how_this_build_will_embody_it": "Read-only calls; anchors added to the sections it links to."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Look past the task: earlier residuals claimed there was no component-test harness.",
    "how_this_build_will_embody_it": "Wrong — corrected in OPEN.md; this build uses it."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "If the panel decided 'done' its own way per step, a step could show a tick its rule wouldn't give.",
    "how_this_build_will_embody_it": "routineSteps in routine.ts; the panel only renders it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "A routine that stored its own counts would drift from the queues it summarizes.",
    "how_this_build_will_embody_it": "Counts are read live."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Guide, don't overtake: a routine lists what's waiting; the manager decides what to do.",
    "how_this_build_will_embody_it": "Steps are counts and links, no automatic action."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Honesty: a count that couldn't be read is not an empty queue.",
    "how_this_build_will_embody_it": "'Couldn't check right now', never a tick; tested."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Logic test and render test, including the failed-source case."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T11:22:39Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
