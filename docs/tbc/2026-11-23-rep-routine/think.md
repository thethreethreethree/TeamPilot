---
started_at: 2026-11-23T11:28:19Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md "a self-coaching routine for reps" (ledger F16.12, manager half built in docs/tbc/2026-11-23-coaching-routine).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The rep's own weekly coaching routine

## The record

- assignments (no ?team) returns the caller's own practice with state due / overdue / attempted / passed.
- feedback_requests (0278) holds the rep's asks; open/answered is derived by isRequestOpen over loadCoachingEvents
  (the coaching inbox's rule). There is no route listing a rep's own requests across calls.
- call_notes (0316) holds the rep's own notes on a call; coaching_sessions gives their phone/video calls.

## Outside view

A rep routine that nags is noise. Each step must be something only the rep can do, counted from their own records:
practice still due, answers from a manager they asked, and recent calls they haven't written a note on. A step that
couldn't be read must not show a tick.

## Design

New GET /api/coach/remote/my-coaching (caller's own rows only): answered feedback in the last 7 days and still-waiting
count; finished phone/video calls in the last 7 days with no note by the rep. routine.ts repRoutineSteps; RepRoutine
on Remote Sales → Today, reusing assignments for practice.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Understand before building: which of the rep's own records already say what's waiting — their assignments (state due/overdue), their feedback requests (answered = closed by closesUnderEveryPolicy), their calls and their call notes — was read first.",
    "how_this_build_will_embody_it": "The rep routine only counts those; no new table."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T11:29:16Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Layer 3: a routine should take the rep straight to the work.",
    "how_this_build_will_embody_it": "Practice links to Training; the newest answered call and the newest call without a note link to that call."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Holistic: the routine reads four existing record kinds; it must not change them or the manager routine.",
    "how_this_build_will_embody_it": "A new read-only route; routine.ts gains repRoutineSteps beside routineSteps."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Look past the task: 'answered' must use the same rule as the manager inbox, or the rep would see 'answered' where the manager sees 'open'.",
    "how_this_build_will_embody_it": "The route calls isRequestOpen with loadCoachingEvents, the inbox's own rule."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "The 'answered' verdict has one authority (feedback.ts); re-deriving it in the panel would drift.",
    "how_this_build_will_embody_it": "The route consumes isRequestOpen; the panel only renders repRoutineSteps."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "A routine that stored its own counts would drift from the records it summarizes.",
    "how_this_build_will_embody_it": "Counts are read live."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Guide, don't overtake: the routine lists what's waiting for the rep; they decide.",
    "how_this_build_will_embody_it": "Counts and links only; no automatic action, no manager view of it."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Honesty: a count that couldn't be read is not 'nothing waiting'.",
    "how_this_build_will_embody_it": "Each part fails on its own as 'Couldn't check right now', never a tick; tested."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Logic test and render test, including the failed-part case."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T11:29:16Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
