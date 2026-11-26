---
started_at: 2026-11-26T07:30:00Z
trigger: Gong ledger F2.8 (P2, PARTIAL) — "It can't remove anyone".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Removing people with the team CSV

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Ledger F2.8: Gong's bulk CSV changes include taking people off; ours could invite, set managers and roles, but not remove anyone — an admin offboarding ten people did it one at a time.",
    "how_this_build_will_embody_it": "An optional action column: 'remove' takes an existing member off, through the same rules as the Team page."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T10:22:38Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Holistic: removal rules lived inline in DELETE /api/team; a second copy for the CSV would drift. Both 'last admin' checks also counted REMOVED admins, so the last active admin could be demoted.",
    "how_this_build_will_embody_it": "removeMember is the one place (Team page and CSV); setMemberRole and removeMember count active admins only."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Layer 3: an admin sees, before anything happens, who would be removed and how many people report to them, and confirms once.",
    "how_this_build_will_embody_it": "Preview rows, the import button's count, and a confirm when removals are in the file."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Adjacent: removals in the same file as other changes must not remove the last admin across rows; removing a manager leaves their reports without one.",
    "how_this_build_will_embody_it": "Removals run last, one at a time, so the last-admin check sees earlier ones; the preview says how many report to them."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "No outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Whether a person may be removed is one verdict (removeMember), consumed by both routes.",
    "how_this_build_will_embody_it": "No re-derived rule in the import."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "A removal is a soft status change, as before; calls and history stay.",
    "how_this_build_will_embody_it": "status 'removed' + removed_at, never a delete."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; removing staff touches no customer data.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "The admin decides; the file is previewed and confirmed.",
    "how_this_build_will_embody_it": "No automatic removals."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "A removal that touched no row is reported, not claimed.",
    "how_this_build_will_embody_it": "removeMember checks the row count."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision: the Team page's removal rule, plus never the last active admin."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: removeMember's rules, the CSV parse and plan, the import's order, the active-admin count."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T10:22:38Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
