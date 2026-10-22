---
started_at: 2026-10-13T10:05:00Z
trigger: R2-the-route-has-no-test-of-its-own, docs/tbc/2026-09-22-bell-unread.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the bell route gets a test of its own

## The record

- The residual: "A change to `.is("read_at", null)` would fail nothing in the suite." The 0264 view half of it is
  covered by scripts/sql-harness.mjs since 2026-09-22; the route's own PostgREST query is not.
- The route makes two reads: the newest 50, and a separate whole-table count of unread rows (head, exact). The
  badge must come from the second; a tally of the first undercounts past 50.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "Understanding precedes solving: what exactly does the open residual say is unguarded?",
    "how_this_build_will_embody_it": "Read R2 of docs/tbc/2026-09-22-bell-unread and the route: the unread count's read_at filter is PostgREST, which the SQL harness cannot reach. Opening printed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-24",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter, printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-10-13T10:10:56Z",
    "why_it_governs": "Layer 2: the bell's badge is the only signal a manager gets that something is waiting; a wrong count hides it.",
    "how_this_build_will_embody_it": "The test pins the badge to the whole-table unread count and to no badge when that count fails. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-142",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "Audit as you work: an open residual with a cheap, real close.",
    "how_this_build_will_embody_it": "Chosen from a scan of every open residual; the others need a browser, a founder decision or a larger harness. Opening printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick.",
    "how_this_build_will_embody_it": "No: a test of existing behaviour, no product change. Printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-456",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "Methodology that governs the build must be read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-595",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "A constitutional citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-771",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "A fix is complete only when the class is a gate.",
    "how_this_build_will_embody_it": "The route test fails when the read_at filter is removed (mutation: 1 failed | 5 passed). Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1002",
    "read_at": "2026-10-13T10:07:49Z",
    "why_it_governs": "'Verified' names the command that was run.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
