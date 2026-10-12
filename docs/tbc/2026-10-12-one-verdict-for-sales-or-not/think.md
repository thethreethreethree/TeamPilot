---
started_at: 2026-10-12T06:15:00Z
trigger: Tracing who receives the new 409 from d76b48a3 (sales coaching on sales calls only).
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - one verdict for "is this a sales call"

## The record

- resolveCoachingMode (src/lib/coach/strategy) is the documented single source for session kind; it treats a
  missing or unknown kind as sales. The meeting routes ask it.
- The new isSalesCall compared `=== "sales"`, so it refused a missing kind. pitch scoring (`!== "sales"`) did the
  same; the session page used `(kind ?? "sales") === "sales"`. Three copies, two of them disagreeing with the
  authority on a missing kind.
- In production they never split: session_kind is `not null default 'sales'` (0237) and getSession fills a gap
  with "sales".
- The sales sessions list has no kind filter and links meetings and huddles to the sales session page, where the
  Summarize tab posts on open and now gets 409.
- The iOS app's dissect card and CARE use other routes (CARE: /api/care/agent/conversations); unaffected.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-12",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "Understanding precedes solving: is the new guard the only answer to 'is this a sales call'?",
    "how_this_build_will_embody_it": "Found while tracing who receives the new 409: the meeting routes ask resolveCoachingMode, the guard compared the raw value. Read both definitions and the column default before changing either. Printed."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-24",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter, printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "Layer 3: what does a person do after the guard refuses?",
    "how_this_build_will_embody_it": "The sales list shows meetings and huddles and links them to the sales session page, whose Summarize tab now fails. They get a link to their own review instead. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-142",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "Audit the neighbours of the change just shipped.",
    "how_this_build_will_embody_it": "Swept every hand-written session-kind comparison in src; the iOS app and CARE call other routes and are unaffected. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-318",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "One verdict; a consumer must not re-derive it, because copies drift.",
    "how_this_build_will_embody_it": "isSalesCall now defers to resolveCoachingMode; pitch scoring and the session page ask it instead of comparing by hand. Printed in full."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick.",
    "how_this_build_will_embody_it": "No pick: it implements the founder's 2026-10-09 choice consistently and changes no behaviour in production, where the column always holds a kind. Printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-456",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "Methodology that governs the build must be read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-595",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "A constitutional citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-771",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "A fix is complete only when the class is a gate.",
    "how_this_build_will_embody_it": "INVARIANT 35 fails a hand-written session-kind comparison; putting the old one back in scoreSession gave 1 violation. Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1002",
    "read_at": "2026-10-12T06:16:19Z",
    "why_it_governs": "'Verified' names the command that was run.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
