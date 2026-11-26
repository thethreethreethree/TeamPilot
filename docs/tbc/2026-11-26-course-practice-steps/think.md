---
started_at: 2026-11-26T04:45:00Z
trigger: Residual R1 of docs/tbc/2026-11-26-training-courses — a course holds lessons only (Gong ledger F17.1 "lessons and practices").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Practice steps in training courses

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "A course held lessons only, while Gong's training mixes lessons and practices; a manager had to assign the course and its scenarios separately and the rep had no single path.",
    "how_this_build_will_embody_it": "A course step can be a practice of one of the company's scenarios; assigning the course assigns it; the rep works through both in one list."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T04:54:20Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Holistic: practice already has assignments, due changes, attempts and a status rule (0282, training.ts). A second 'done' flag for practice would drift from it.",
    "how_this_build_will_embody_it": "A practice step's done is assignmentStatus over the existing rows; the course adds no new practice table."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Layer 3: a rep who practises from a course lands on the role-play screen; without a way back the course stalls.",
    "how_this_build_will_embody_it": "'Back to Training' on the practice screen; 'Practise it' on the step."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Adjacent: a course edited after reps started it, adding a practice step, would leave those reps with a step they can't open; and the editor was not the manager who placed them.",
    "how_this_build_will_embody_it": "A new version assigns its new practice to existing takers, assigned_by the manager who gave them the course; if that write fails the save says so."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "0357 is applied in production; the old check names were confirmed live before the apply and gone after.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live 33/33; constraints listed before and after."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "One verdict for practice done: assignmentStatus, consumed by the course route.",
    "how_this_build_will_embody_it": "No re-derived pass rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Append-only: practice steps are new step versions; practice assignments are inserts of missing pairs only.",
    "how_this_build_will_embody_it": "No update or delete."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a practice step stores a scenario id and an optional manager note, never call text.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "The manager picks the scenarios; the system adds nothing on its own.",
    "how_this_build_will_embody_it": "No generated steps."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "No fixed day-one content: a company with no scenarios can't add practice steps, and the editor says to write one first.",
    "how_this_build_will_embody_it": "Practice is disabled with that sentence until a scenario exists."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision: practice done = the existing practice rule (attempted, or passed when there is a mark)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "No citation — and no allowlist reason — without reading the route: the courses route's reason said no rep is acted on, which a new version's practice now makes untrue.",
    "how_this_build_will_embody_it": "Reason rewritten to name the write and who it is assigned by."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: practice done from attempts, no hand tick, existing takers assigned by the original manager, scenario must be live."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T04:54:20Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
