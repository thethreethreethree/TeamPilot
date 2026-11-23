---
started_at: 2026-11-23T20:48:05Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md coaching "an answered feedback request stays a to-do for 7 days even after the rep has read it".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Clear a feedback answer once the rep has seen it

## The record

- my-coaching counts requests answered in the last 7 days; nothing records the rep reading them.
- The rep sees an answer on the call page: FeedbackRequest shows "Answered." for the call's own rep.

## Outside view

A checklist that keeps a done item looks broken. The honest signal is the rep opening the answer, not a tick they
could press without reading.

## Design

0321 feedback_answer_views (own-row RLS, append-only). POST /api/coach/remote/:id/feedback-seen from FeedbackRequest
when it shows "Answered." to the rep. my-coaching counts an answer only if newer than the latest view of that call.
Checklist wording: "answers from your manager to read".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Understand before building: the rep routine's own residual — an answered request stayed a to-do for 7 days after it was read — and where the rep reads an answer (the call page's FeedbackRequest 'Answered.' state) were read first.",
    "how_this_build_will_embody_it": "A view is recorded exactly where the rep sees the answer."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T20:50:53Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Layer 3: a to-do the rep already did keeps nagging; that teaches them to ignore the checklist.",
    "how_this_build_will_embody_it": "Seeing the answer clears it; a newer answer brings it back."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Holistic: the new table is keyed to a call; legal erasure and the RLS audit read every such table.",
    "how_this_build_will_embody_it": "No words stored (ids and a time), so erasure needs nothing; own-row select/insert policies; append-only rules."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Look past the task: a view before the answer must not hide it.",
    "how_this_build_will_embody_it": "Counted only when the answer is newer than the latest view; tested both ways."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0321 applied to production before the push."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "'Answered' and 'answered at' come from feedback.ts alone.",
    "how_this_build_will_embody_it": "my-coaching compares requestAnsweredAt to the latest view; no new rule for answered."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "A view is a fact over time.",
    "how_this_build_will_embody_it": "Append-only rows; DB rules refuse update/delete."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "No customer words in the table."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Guide, don't overtake: the checklist reflects what the rep did.",
    "how_this_build_will_embody_it": "No automatic marking; only opening the answer counts."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Honesty: a failed read must not clear the list.",
    "how_this_build_will_embody_it": "A failed view read makes the part 'couldn't check' (null), never zero."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests (seen hides; earlier view doesn't; only the call's rep records), render test (posted only on the rep's answered view), policy replay."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T20:50:53Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
