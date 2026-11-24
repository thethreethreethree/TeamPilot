---
started_at: 2026-11-24T20:35:12Z
trigger: Gong ledger F16.6 "Inbox actions and filters" (P1, PARTIAL): no 'no feedback yet' filter on recorded calls.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Go straight to a call nobody has coached

## The record

coachingByRep (2497dd2c) counts each rep's calls with no feedback in 30 days; the Coaching page shows the count.

## Outside view

A count with no way to act on it sends the manager hunting through the calls list.

## Design

RepCoaching.uncoached = those calls, newest first, with the client label. The count is a button that lists them; each
links to /dashboard/remote-sales/calls/<id>.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Ledger F16.6: Gong filters recorded calls to those with no feedback and goes straight to one; ours showed only a count of uncoached calls per rep (added hours earlier).",
    "how_this_build_will_embody_it": "The count becomes the list it counts, from the same computation."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:35:13Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Holistic: the uncoached list must be exactly the calls behind the count, not a second query that could disagree.",
    "how_this_build_will_embody_it": "coachingByRep returns both; the count is the list's length."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Layer 3: a manager sees 'Bo · 2 not yet coached' and the next action is to open one of them.",
    "how_this_build_will_embody_it": "The count is a button; each listed call opens the call page."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Look past the task: a call with no client name would render as a blank link.",
    "how_this_build_will_embody_it": "'Untitled call' fallback, tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Whether a call has feedback is decided by the D8 events in coachingByRep.",
    "how_this_build_will_embody_it": "The list is that verdict's output; nothing re-derives it."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Honesty: the list shows only calls the manager may see.",
    "how_this_build_will_embody_it": "The calls come from the tree-filtered set the route already uses."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "feedback.test.ts pins which call is uncoached; the render test pins the links and the fallback."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:35:13Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
