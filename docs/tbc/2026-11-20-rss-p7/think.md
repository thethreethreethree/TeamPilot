---
started_at: 2026-11-20T20:00:00Z
trigger: Founder 2026-11-20, "continue" — RSS plan docs/rss Phase 7 (training), and the phase gate (npm run check) for Phases 0-7 now that Node exists on the build machine.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - RSS Phase 7: training, and the first executed gate for Phases 0-7

## The record

- Phases 0-6 (docs/tbc/2026-11-15-rss-p0 … 2026-11-20-rss-p6) were written on a machine with no Node. Every one
  closed with the residual "npm run check not run". Phase 7's code (0282, 0283, training.ts, the scenarios /
  assignments / practice-ask routes, TrainingManager, AssignedPractice, PracticeFollowUp, the role-play route's
  assignment branch) was on disk with no build record, and OPEN.md still said "Next: Phase 7".
- docs/rss/docs/07-BUILD-ORDER.md "Gate between phases": `npm run check` green before the next phase. So the gate
  runs before Phase 7 is called done, and before Phase 8 starts.
- Phase 7 in the plan: apply 0277 (renumbered 0282); scenarios, assignments, due dates, practice follow-up chat; a new
  manager_notifications type in its own migration (0283); voice role-play only if D9 says so (D9 open → text
  role-play unchanged). Screen placement is D18, open: "Tables built; screen placement open". The build does not
  invent an answer (00-OPEN-DECISIONS.md), so TrainingManager is built and NOT mounted.

## Outside view

The danger in seven phases written without running anything is the confident, well-formed failure: tests that mock
the database pass whatever the database would do. The question for each write is therefore "what does Postgres do
with this statement", not "does the mock return success".

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-14", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Seven phases of unexecuted code: the actual behaviour had to be established before calling any of it done.",
   "how_this_build_will_embody_it": "Ran every gate step; executed the RSS writes against real Postgres (PGlite 16.4) before changing them."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "The plan (docs/rss) and the constitution must be in the tree and read this session.",
   "how_this_build_will_embody_it": "07-BUILD-ORDER Phase 7 + gate, 06-UI-SPEC Training, 00-OPEN-DECISIONS D9/D18 read this session; ThinkerThinker assets below read this session."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-80", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Layer 2: a feature whose write errors on every call does not work, whatever its tests say.",
   "how_this_build_will_embody_it": "Four ON CONFLICT writes on rule tables replaced; each write path executed against the schema."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Look past the task: the gate's own detectors can be wrong.",
   "how_this_build_will_embody_it": "INVARIANT 33's ignoreDuplicates exemption and sql-harness's empty-reason probe were both found wrong and fixed."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Checklist item 0: a decision the plan already settles is not put to the founder.",
   "how_this_build_will_embody_it": "D18 follows the plan's stand-in (unmounted, allowlisted with reason), not a picker."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
   "how_this_build_will_embody_it": "Assets opened by line this session; the plan's decisions file decided D18's handling."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-775", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "INVARIANT 33 now fails any .upsert on a rule table, ignoreDuplicates included."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1006", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "A verification claim is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md pastes each gate step's exit code; the two Postgres steps are recorded as SKIPPED, not passed."}
]
```
