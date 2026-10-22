---
started_at: 2026-10-22T20:55:00Z
trigger: Founder picker 2026-10-23, "Sales calls only (Recommended)" for the Sales Coach sessions list.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the sales list shows sales calls only

## The record

- /api/coach/sales-session/list returned every kind; meetings and huddles appeared in the sales list, and since
  d76b48a3 opening one shows only a link to its meeting review.
- Meeting Coach's page renders MeetingHistoryList (GET /api/coach/meeting-session, kind-filtered to meeting and
  huddle in the query), each row linking to /dashboard/meeting-coach/[id]/review.
- The meeting review is facilitator-only (403 otherwise), so managers lose nothing they could open.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "Understanding precedes solving: where do meetings go if the sales list drops them?",
    "how_this_build_will_embody_it": "Traced before changing: Meeting Coach lists the rep's own meetings and huddles (MeetingHistoryList, kind-filtered in the query) with a link to each review; the review is facilitator-only, so a manager never could open a team meeting from the sales list. Opening printed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-24",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter, printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "Layer 3: nothing a rep recorded becomes unreachable.",
    "how_this_build_will_embody_it": "Every row in the sales list now opens a sales review; meetings and huddles stay reachable from Meeting Coach's history. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-142",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "Audit the neighbours: who else reads the list route.",
    "how_this_build_will_embody_it": "One consumer (dashboard/sales-coach/sessions); the iOS app reads sessions directly and already shows a meeting note in place of sales cards. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-309",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "One verdict, not a re-derived one.",
    "how_this_build_will_embody_it": "The filter excludes NON_SALES_KINDS, the same constant nonSalesSubjects uses, which is pinned to isSalesCall by test. Printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "Item 0: the founder's pick.",
    "how_this_build_will_embody_it": "Founder picker 2026-10-23: 'Sales calls only'. Printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-456",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "Methodology that governs the build must be read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-595",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "A constitutional citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-771",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "A fix is complete only when the class is a gate.",
    "how_this_build_will_embody_it": "The route test fails when the filter is removed (2 failed | 17 passed). Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1002",
    "read_at": "2026-10-22T20:57:14Z",
    "why_it_governs": "'Verified' names the command that was run.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
