---
started_at: 2026-10-13T08:30:00Z
trigger: Audit after d76b48a3 (sales coaching on sales calls only) - the write side was guarded, the read side was not checked.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the read side of sales-only

## The record

- Before the guard, 6 sales after-pitch summaries and several dissects, summaries, pivots, intel and moments were
  stored on meetings and huddles (production events, read 2026-10-13).
- The GET handlers of after-pitch, summarize, why and sales-session/dissect serve the latest stored row without
  asking the session kind. The website session page fetches after-pitch and summarize for any session opened from
  the sales list, which includes meetings and huddles.
- INVARIANT 34 passed these files because isSalesCall appeared in their POST handlers: a file-level check.
- A dry run of a per-handler rule flagged 4 more handlers: list, coach-assessment and my-training aggregate across
  many calls; finalize reads the dissect marker for idempotency only.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "Understanding precedes solving: why would a meeting still show a sales grade after the guard?",
    "how_this_build_will_embody_it": "Traced from the session page's after-pitch fetch to the GET handler: it serves the stored row without asking the kind. The write guard never covered reads. Opening printed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-24",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter, printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "Layer 2: the founder's ruling is that meetings never get sales reviews; showing a stored one breaks it.",
    "how_this_build_will_embody_it": "A meeting now gets each route's existing empty answer, which every caller already renders as nothing stored. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-142",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "Audit the neighbours: every handler that serves stored sales output.",
    "how_this_build_will_embody_it": "Swept every handler under sales-session by a dry run of the sharper rule: 4 per-call GETs fixed, 4 aggregate or marker reads exempted with reasons. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-312",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "One verdict, consumed by every handler.",
    "how_this_build_will_embody_it": "Each GET branches on isSalesCall, the same verdict as its POST sibling. Printed."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-341",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "Append-only: the 6 stored reviews cannot be deleted.",
    "how_this_build_will_embody_it": "They stay in the event log; the routes stop serving them. Printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick.",
    "how_this_build_will_embody_it": "No new pick: it completes the founder's 2026-10-09 choice ('Sales coaching on sales calls only'). Printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-456",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "Methodology that governs the build must be read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-595",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "A constitutional citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-771",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "A fix is complete only when the class is a gate.",
    "how_this_build_will_embody_it": "INVARIANT 34 is now per handler and covers reads; disabling the summarize GET guard gave 1 violation naming the handler. Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1002",
    "read_at": "2026-10-13T08:31:56Z",
    "why_it_governs": "'Verified' names the command that was run.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
