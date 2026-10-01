---
started_at: 2026-10-01T04:45:00Z
trigger: Residual R3 of docs/tbc/2026-09-29-quiet-undo-for-a-door - the 0267 RLS probe is committed and re-runnable but nothing runs it, so a policy change that breaks it would pass every gate.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - RLS probes run in CI

## The problem, from the record

`scripts/sql/probes/0267-door-knock-undos.rls.sql` runs 0267's insert policy as a rep, both branches of every
term. But it ran with errors non-fatal (the refusals are the point) and ended in a printout. Nothing compared
the printout with anything, and nothing ran it except a person following the comment at the top.

## The design

- The probe ends in an assertion block under `ON_ERROR_STOP 1`: the fixture, each case, and the live/raw
  counts. A wrong result stops psql with a non-zero exit and a message naming the case.
- `scripts/migration-apply-audit.mjs` gains PASS 3: after the migrations, every `scripts/sql/probes/*.sql`
  runs on its own `template` copy of the migrated database. CI already runs this script against
  postgres:16-alpine on every push, so no workflow change is needed.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T04:51:57Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The gap was read from the record first: the quiet-undo closure R3 says the probe is committed but not in CI, and the probe ends in a printout with no exit code that could fail anything."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T04:51:57Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Both governing documents are in the tree; every clause below was printed and read after this build started."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T04:52:00Z",
    "why_it_governs": "Four layers in order; the operator who runs the gate is the user here.",
    "how_this_build_will_embody_it": "L1: the probe pass lives inside the existing migration audit, reusing its fresh database, not a new CI job. L2: a weakened policy now fails CI with a message naming the case. L3: no workflow change; a developer without Postgres still gets the audit's honest SKIPPED. L4: the failure line names the case and what it means."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T04:52:00Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "Closing a recorded residual rather than a new request; the probe's fixture check is itself an assertion, so a broken fixture cannot pass as a holding policy."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-01T04:51:53Z",
    "why_it_governs": "A re-derived decision needs a drift guard on both branches of every term.",
    "how_this_build_will_embody_it": "0267's 60-minute, own-knock, own-company rule lives in undoKnock AND the RLS policy. The probe exercises every term both ways; it is now that drift guard in CI, not only on a laptop."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T04:52:00Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision involved: CI wiring for an existing probe. Item 3: this does not repeat a failed approach."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T04:52:03Z",
    "why_it_governs": "Methodology must be read in session, not cited from labels.",
    "how_this_build_will_embody_it": "Printed and read at the recorded time; long paragraphs were cut at 500-600 characters in that print."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T04:52:03Z",
    "why_it_governs": "A citation without an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "An earlier attempt this build stamped a time after printing only line counts; it was not used. The times here follow an actual print of the text."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T04:51:53Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "The probe was the lesson in a file someone had to remember to run. It is now a gate: CI applies every migration, runs every probe, and fails on the assertions (mutation: a 600-minute window, caught)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T04:52:03Z",
    "why_it_governs": "'Verified' is a claim about a named command.",
    "how_this_build_will_embody_it": "migration-apply-audit against postgres:16-alpine and npm run check, both by name with exit codes, in check.md."
  }
]
```
