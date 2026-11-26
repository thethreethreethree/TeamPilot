---
started_at: 2026-11-26T05:00:00Z
trigger: Residuals R3 (docs/tbc/2026-11-26-training-courses) and R1 (docs/tbc/2026-11-26-course-practice-steps).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Course due dates and retired scenarios

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Two gaps from the course builds: a course's due date couldn't be moved (residual R3), and a scenario retired after it was put in a course would still be handed to new course takers (practice residual R1).",
    "how_this_build_will_embody_it": "Due changes as rows (0358) with a date field on the progress table; assignPractice skips retired scenarios."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T05:15:03Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Holistic: 0282 defines retire as 'no new assignments'; a course path that ignored it would quietly undo the manager's retire.",
    "how_this_build_will_embody_it": "The retire rule is checked where course practice is assigned, for both assign and edit."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Layer 3: a manager who sees a rep overdue on a course needs to move the date from that row, not elsewhere.",
    "how_this_build_will_embody_it": "Date field in the course progress row; saving says 'Due date changed.' and the table reloads."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Adjacent: the course's state (overdue) and the rep's due line must follow the moved date everywhere.",
    "how_this_build_will_embody_it": "The route's dueAt and courseProgress both use currentDue (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "0358 is applied in production with its MFA policy; verify:live passed.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "The current due date is one verdict: currentDue, shared with practice (training.ts).",
    "how_this_build_will_embody_it": "No second latest-row rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "A moved due date is an event, not an edit to the assignment.",
    "how_this_build_will_embody_it": "training_course_due_changes rows with no-update/no-delete rules."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a due change stores dates and ids only.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "The manager sets the date; the system doesn't move it on its own.",
    "how_this_build_will_embody_it": "No automatic due changes."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "No fixed behavior is introduced; due dates are the manager's.",
    "how_this_build_will_embody_it": "No defaults added."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision: both rules mirror 0282's practice rules."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate. The MFA miss of 0355 is now a static rule, and 0358 passed it before it was applied.",
    "how_this_build_will_embody_it": "0358 carries mfa_required from the start; tests for retired skip and due change."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T05:15:03Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
