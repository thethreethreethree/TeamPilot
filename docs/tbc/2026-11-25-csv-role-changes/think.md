---
started_at: 2026-11-25T00:13:24Z
trigger: Gong ledger F2.8 "Bulk team changes by CSV" (P2, PARTIAL): can't change an existing person's role.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Team CSV changes roles too

## The record

teamCsv.ts (parse, planImport); /api/team/import (preview / apply: invitations, managers); /api/team/set-role (admin,
company pin, last-admin 409).

## Design

setMemberRole (shared). planImport: roleFrom for members whose row names a different role. Import: preview
roleChange; apply through setMemberRole row by row. UI: 'role X → Y'.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "Ledger F2.8: the team CSV invites and sets managers but can't change an existing person's role; it deferred roles to the Team page because the role rules lived only in /api/team/set-role.",
    "how_this_build_will_embody_it": "Move those rules into one function and use it from both."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-25T00:13:25Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "Holistic: a role is admin authority (C-Suite = admin); a bulk change could lock a company out.",
    "how_this_build_will_embody_it": "setMemberRole refuses removing the last admin, applied row by row so each later row sees earlier changes."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "Layer 2-3: an admin reorganising a team edits one sheet and sees every change before applying.",
    "how_this_build_will_embody_it": "The preview shows 'role X → Y'; apply reports each result."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "Look past the task: a CSV role would be checked against invitable roles while the page checks assignable roles.",
    "how_this_build_will_embody_it": "The CSV keeps the narrower invitable list; the rest of the rules are shared."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "The role rules must have one home, not a copy in the import.",
    "how_this_build_will_embody_it": "setMemberRole; /api/team/set-role now calls it (its 7 tests unchanged and passing)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: the Team page already lets an admin do the same one by one."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "setMemberRole tests (company pin, last admin); import tests (preview writes nothing, apply goes through the function)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T00:13:25Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
