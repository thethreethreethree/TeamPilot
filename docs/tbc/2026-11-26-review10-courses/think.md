---
started_at: 2026-11-26T05:30:00Z
trigger: Independent review of 17188412..bcec5e3e (training courses) — five confirmed defects plus a library banner.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of the training-course builds

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "An independent review of 17188412..bcec5e3e traced five defects: a retired practice left new takers with a course they could never finish; practice due dates drifted from the course's; a failed reload after Mark done said 'You finished'; the Assign result always said 'Assigned.'; due days were read in the server's zone.",
    "how_this_build_will_embody_it": "Each fixed at its cause, with a test for each scenario the review gave."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T05:53:17Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Holistic: retiring a scenario (0282) silently changed courses that use it, and moving a course's date left its practice on the old one — two features that each worked alone and disagreed together.",
    "how_this_build_will_embody_it": "Retired-before-assigned practice leaves the count and says why; moving a course's date moves its unfinished practice (training_due_changes rows)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Layer 3: a rep told they finished, or a manager told 'Assigned.' when two picks were outside their team, leaves each acting on something untrue.",
    "how_this_build_will_embody_it": "Honest sentences: 'Saved. Couldn't refresh…'; 'Assigned to 1 rep. 1 already had it. 2 aren't on your team.'"
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Adjacent: TrainingManager had the same timezone pattern; two .in() lists in one request could outgrow the URL; the library's 'not here' banner fired on the Mine tab.",
    "how_this_build_will_embody_it": "dueEndOfDay/dayOf used by both editors; scenario lists cut to 40; the banner judges the company tab only."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "No migration and no outside configuration in these fixes.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "The current due date is one verdict (currentDue): the course PUT and the retry now use it instead of the original due_at they re-derived.",
    "how_this_build_will_embody_it": "currentDue everywhere a course's due date is used."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Moving practice due dates is append-only: new training_due_changes rows, never an edit.",
    "how_this_build_will_embody_it": "Rows inserted; nothing updated."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; these fixes store dates and ids only.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Guide, don't overtake: a manager's retire is respected (no new practice) and explained to the rep, not hidden.",
    "how_this_build_will_embody_it": "'This practice was retired before it reached you — it doesn't count toward the course.'"
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers. The review's design point (any manager may edit any company course) is the existing rule for scenarios and needs no new decision.",
    "how_this_build_will_embody_it": "Recorded as a residual, not changed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A test per review finding."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T05:53:17Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
