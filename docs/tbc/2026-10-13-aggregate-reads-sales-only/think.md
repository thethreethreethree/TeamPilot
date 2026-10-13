---
started_at: 2026-10-13T09:00:00Z
trigger: R1-aggregate-reads, the residual left by docs/tbc/2026-10-13-sales-only-read-side.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - aggregate reads of sales reviews leave meetings out

## The record

- 2 sales dissects were generated on non-sales sessions before the guard (one meeting, one huddle; production
  events, read 2026-10-13).
- my-training reads the caller's dissects by actor; coach-assessment counts and reads each rep's dissects by actor.
  Neither looks at the session the dissect belongs to, so both still counted those 2.
- session_kind is `not null` with a check of sales / meeting / huddle (0237), so "not a sales call" is exactly
  meeting and huddle, the same set resolveCoachingMode treats as non-sales.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "Understanding precedes solving: why do the training and assessment pages still count meeting reviews?",
    "how_this_build_will_embody_it": "They read a rep's dissects by actor across all calls; the per-call guard cannot reach a cross-call aggregate. Read both routes before changing them. Opening printed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-24",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter, printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "Layer 2: a rep's training focus and a manager's assessment must come from sales calls only.",
    "how_this_build_will_embody_it": "Both reads now leave meetings and huddles out; a failed lookup degrades the page as their other failed reads already do. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-142",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "Audit the neighbours: the residual left by the read-side fix.",
    "how_this_build_will_embody_it": "Closes R1-aggregate-reads from docs/tbc/2026-10-13-sales-only-read-side; the sales list stays under R1-sales-list-shows-meetings. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-312",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "One verdict, not a re-derived one.",
    "how_this_build_will_embody_it": "nonSalesSubjects asks for exactly the kinds isSalesCall treats as not a sales call (meeting, huddle), pinned by a test against isSalesCall. Printed."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-341",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "Append-only: the 2 stored reviews stay.",
    "how_this_build_will_embody_it": "They are filtered out of the reads, never deleted. Printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick.",
    "how_this_build_will_embody_it": "No: it completes the founder's 2026-10-09 choice for the last two readers. Printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-456",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "Methodology that governs the build must be read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-595",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "A constitutional citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-771",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "A fix is complete only when the class is a gate.",
    "how_this_build_will_embody_it": "INVARIANT 34 now requires nonSalesSubjects in the two aggregate routes instead of exempting them; removing it from my-training gave 1 violation. Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1002",
    "read_at": "2026-10-13T09:01:35Z",
    "why_it_governs": "'Verified' names the command that was run.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
