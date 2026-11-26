---
started_at: 2026-11-26T02:48:26Z
trigger: docs/tbc/2026-11-26-tree-check-503 R1-other-callers.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The team picker says when it couldn't check

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Residual R1-other-callers: the team picker (teamFromRequest, seven routes) answered a failed tree check as 'Team not found'.",
    "how_this_build_will_embody_it": "teamFromRequest takes an unknown answer and returns 503; its seven callers pass treeAllowsRepChecked."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T02:49:41Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Holistic: one helper serves seven routes — fixing it there changes all of them the same way.",
    "how_this_build_will_embody_it": "One change in teamScope.ts; the callers only swap the helper."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Layer 2: 'Team not found' for a team the manager may see sends them to the wrong conclusion.",
    "how_this_build_will_embody_it": "503 'Couldn't check your team right now.'"
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Adjacent: 13 more routes call treeAllowsRep directly with their own refusal wording; all fail closed.",
    "how_this_build_will_embody_it": "Recorded; each can move when touched."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "'Unknown' is its own verdict from the tree; teamFromRequest now passes it through rather than reading it as 'no'.",
    "how_this_build_will_embody_it": "boolean | null in the callback type."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Authorization reads only; no event or write changes.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "No customer data is involved in this change.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "A person is not told a team doesn't exist when the system merely failed to check.",
    "how_this_build_will_embody_it": "An honest 'try again'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A teamScope test for the 503 (nothing read)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T02:49:41Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
