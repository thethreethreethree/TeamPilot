---
started_at: 2026-11-23T09:30:00Z
trigger: Deal-sentiment finding F1 (production: 0 calls linked to prospects), under the founder's standing "keep building everything in the list".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Link a call to its prospect, from any call view

## The record

- Production: remote_prospect_calls = 0 rows (read 2026-11-23).
- The only control: MacroCallView ProspectStrip — rendered only when Remote Sales Macro Mode is on and the full view is
  not chosen (SessionDetailView:474); it could only POST a NEW prospect named from the call label.
- POST /prospects/:pid { action: "link", sessionId } already existed; 0304 lets only the call's rep link it.

## Outside view

A feature nobody can reach looks the same as a feature nobody wants. "New prospect" as the only choice also punishes
the rep's second call with a customer: a duplicate or nothing.

## Design

GET /api/coach/remote/:id/pipeline-link (link, isOwner, label, the rep's open prospects); CallPipelineLink on every
finished remote call (full view and Macro Mode, replacing the strip); writes reuse the existing routes.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Understand before fixing: why production has 0 linked calls was traced from the record — the control's only mount and what it can do.",
    "how_this_build_will_embody_it": "Found: only in Macro Mode's call view, and only 'new prospect'; the fix targets both causes."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Layer 3: last call, Ask Coach summaries, sentiment and calendar names all depend on a step the workflow never offered.",
    "how_this_build_will_embody_it": "Every finished remote call now asks 'which prospect was this call with?' with the rep's open prospects or a new one."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Holistic: replacing Macro Mode's strip touches its tests and its next-call-date control, which reads the prospect from the brief.",
    "how_this_build_will_embody_it": "One shared control in both views; it calls onLinked so Macro Mode reloads; the Macro screen tests were updated, not deleted."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Look past the task: the deal-sentiment build found 0 links — the cause was a workflow gap, not missing data.",
    "how_this_build_will_embody_it": "Closed here; the residual is resolved on the record."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "External config can keep a feature silently empty.",
    "how_this_build_will_embody_it": "None: existing routes and tables."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Who may link a call is decided by the database (0304: only the call's rep).",
    "how_this_build_will_embody_it": "The screen reads isOwner from the route and the write still goes through 0304's policy."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "A call's prospect is a fact appended, not edited.",
    "how_this_build_will_embody_it": "Linking inserts a remote_prospect_calls row; nothing is updated."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Guide, don't overtake: the rep chooses the prospect.",
    "how_this_build_will_embody_it": "Nothing is linked automatically; no guess is made from the call label."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Honesty: a failed read must not offer 'add' for a linked call.",
    "how_this_build_will_embody_it": "The route answers 500, and the control says it couldn't check."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: it makes an existing feature reachable."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route rules are tests; the Macro screen tests now assert the shared control."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T09:33:05Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
