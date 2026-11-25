---
started_at: 2026-11-25T22:12:32Z
trigger: Gong ledger F6.3 "Manual file upload" (P1, PARTIAL): no renaming while it processes.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Rename a call from its page

## Design

RenameCall (PATCH /api/coach/sales-session/[id] with {clientLabel} only — the existing owner-only rename). Mounted on
the Remote Sales call page for the call's rep, processing or finished.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Ledger F6.3: an uploaded or recorded call can only be named at the moment it ends; Gong lets the person rename it while it processes or after.",
    "how_this_build_will_embody_it": "A 'Rename call' control on the Remote Sales call page for its rep."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:12:33Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Holistic: the rename already exists in the PATCH route (owner-only, renameSession); a new route would duplicate its rule.",
    "how_this_build_will_embody_it": "The control calls the existing route with clientLabel only — never a status change (tested)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Layer 3: a call named 'Upload 3' stays unfindable in lists and Search until renamed.",
    "how_this_build_will_embody_it": "Rename from the call page; the header updates at once."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Look past the task: a manager seeing the control would hit a 403.",
    "how_this_build_will_embody_it": "Shown only when the viewer is the call's rep (viewerId === agentId)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Who may rename is decided by the PATCH route (existing.agentId === caller).",
    "how_this_build_will_embody_it": "The screen consumes that rule's 403 rather than re-deciding; it only hides the control for others."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "A call's label is an entity field the existing route already updates; no new state.",
    "how_this_build_will_embody_it": "No new table; the existing rename path."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Erasure blanks client_label; a rename must not defeat that.",
    "how_this_build_will_embody_it": "Erasure's update of client_label is unchanged and runs after any rename."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Guide, don't overtake: the rep names their own call.",
    "how_this_build_will_embody_it": "Optional control; nothing renamed automatically."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; private/delete-while-processing recorded as not built."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Render test pins the body (name only) and refusals."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:12:33Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
