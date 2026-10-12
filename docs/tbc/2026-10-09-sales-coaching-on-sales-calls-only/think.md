---
started_at: 2026-10-10T01:47:00Z
trigger: Founder picker 2026-10-09, "Sales coaching on sales calls only (Recommended)". Production showed sales engines running on meetings and huddles.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - sales coaching on sales calls only

## The record

- 6 sales after-pitch summaries stored on meetings or huddles; engine runs on them up to 2026-10-07.
- Ledger: 152 session_score rows; 151 on sales calls, 1 on a huddle (session 79bea05b, 54 points, 2026-09-04).
- generateSessionArtifacts and generateAndStoreAfterPitch never read session_kind. The routes summarize, why,
  ask-coach, summary-scores and sales-session/dissect call engines directly. dissectBackfill selected every ended
  session, so meetings were re-tried every 14 days.
- attribute-unlabelled already refused non-sales calls, with its own `!== "sales"` (a second copy of the rule).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "Understanding precedes solving: why did a huddle get a sales grade and points?",
    "how_this_build_will_embody_it": "Traced from the ledger row back to the engines: generateSessionArtifacts and generateAndStoreAfterPitch never looked at session_kind, and five on-demand routes call engines directly. Opening printed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-24",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter, printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "Layer 2: a meeting must not come back with a sales review a rep cannot use.",
    "how_this_build_will_embody_it": "Each sales-session engine route answers 409 with a plain sentence for a meeting or huddle; the meeting review path is untouched. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-142",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "Audit as you work: the neighbours of the two entry points.",
    "how_this_build_will_embody_it": "Swept every route under sales-session that calls an engine; five were unguarded, plus the backfill query that re-tried meetings every 14 days. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-312",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "One verdict, consumed everywhere, never re-derived.",
    "how_this_build_will_embody_it": "isSalesCall in salesOnly.ts is the single verdict; attribute-unlabelled's own `!== \"sales\"` now calls it. Printed."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-10-10T01:47:54Z",
    "why_it_governs": "Append-only: the huddle's 54 points cannot be deleted or edited.",
    "how_this_build_will_embody_it": "The ledger row stays; the reversal is a separate decision recorded in closure.md, because a correction row alone does not reach the readers that count sessions. Printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick.",
    "how_this_build_will_embody_it": "The founder picked 'Sales coaching on sales calls only' on 2026-10-09; the reader gap found while doing the reversal goes back to them as a picker. Printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "Methodology that governs the build must be read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-597",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "A constitutional citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-772",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "A fix is complete only when the class is a gate.",
    "how_this_build_will_embody_it": "INVARIANT 34 fails any sales-session route that calls a sales engine without isSalesCall; removing the why guard gave 1 violation. Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1003",
    "read_at": "2026-10-10T01:47:52Z",
    "why_it_governs": "'Verified' names the command that was run.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
