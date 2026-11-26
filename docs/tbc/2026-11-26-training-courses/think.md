---
started_at: 2026-11-26T04:20:00Z
trigger: Gong ledger F17.1 (P2, LACK) — training as ordered lessons; D18 (decided 2026-11-23) places training in Remote Sales → Training.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Training courses (ordered lessons)

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Gong builds training as ordered lessons and practices; ours has practice scenarios only, and Bootcamp's page says materials are coming. A manager has nowhere to put a lesson a rep should read before practising.",
    "how_this_build_will_embody_it": "Courses: ordered lessons a manager writes and assigns with a due date; the rep reads them in order and marks each done."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T04:21:44Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Holistic: 0309 requires mfa_required on every table that grants access; my four tables lacked it and verify:live failed after the apply.",
    "how_this_build_will_embody_it": "0356 adds it; a new static audit rule fails any post-0309 table with a policy and no mfa_required (mutation-tested: 4 violations without 0356)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Layer 3: after marking a lesson done the rep must land on the next one, and after saving a course the manager's next step is choosing who takes it.",
    "how_this_build_will_embody_it": "Mark done opens the next unfinished lesson; a new course opens its Assign panel."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Adjacent: editing a course must not wipe a rep's progress; a removed lesson must not count.",
    "how_this_build_will_embody_it": "Lessons keep a step_uid across versions; progress counts only the current version's lessons (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "The tables live in production; the migration was applied and verify:live passed after 0356.",
    "how_this_build_will_embody_it": "db:verify and db:apply ran; verify:live 33/33."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Progress is one verdict (courseProgress) for the rep's list and the manager's table.",
    "how_this_build_will_embody_it": "Both read the route's state; neither recomputes it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Events are immutable: a course edit must not update rows.",
    "how_this_build_will_embody_it": "Each save appends a new version; assignments and completions have no-update/no-delete rules; a course can only be retired."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Courses hold manager-written lessons, no customer data.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Guide, don't overtake: the manager writes the lessons; the system writes nothing for them.",
    "how_this_build_will_embody_it": "No AI-written lesson content in this build."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "No fixed day-one behavior: there are no built-in courses; a company starts with none.",
    "how_this_build_will_embody_it": "Empty state: 'No courses yet' with what a course is."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers. D18 already placed training in Remote Sales → Training.",
    "how_this_build_will_embody_it": "No new decision; placement follows D18."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The MFA miss is now a static invariant, not a note."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T04:21:44Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
