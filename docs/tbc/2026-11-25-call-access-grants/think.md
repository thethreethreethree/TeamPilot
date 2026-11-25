---
started_at: 2026-11-25T01:58:49Z
trigger: Gong ledger F3.8 "Per-call user access grants" (P2, PARTIAL); founder picker 2026-11-25 "Admin grants, logged".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - An admin gives one teammate access to one call

## Design

0336 call_access_grants + call_access_revocations (append-only; RLS: grantee reads own) + 'call_access_granted' notice.
callGrants.ts (grantsForCall, activeGrant). /api/coach/remote/[id]/grants (admin: list, grant, revoke; audited).
/api/coach/remote/shared/[id] (grantee: read-only view; audited). Shared page; admin panel on the call page; bell.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Ledger F3.8: no way to give one person access to one call outside the tree and the rep-consented library; the founder chose admin grants, logged.",
    "how_this_build_will_embody_it": "Grants and revocations as records; a read-only view gated on an active grant."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-25T01:58:50Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Holistic: a call's own tables carry RLS used everywhere; widening them for grants would touch every reader.",
    "how_this_build_will_embody_it": "No RLS on call tables changes; one route serves the granted view after checking the grant; trims are skipped there too."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Layer 3: the person given access needs a way in, and the rep needs to know.",
    "how_this_build_will_embody_it": "Both get a bell notice; the grantee's opens the shared page."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Look past the task: a trimmed section must stay hidden in the shared view; a missing grant must not confirm the call exists.",
    "how_this_build_will_embody_it": "Active trims are skipped in the shared player; no grant → 404 before any call read (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0336 applied and replayed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "'May this person open this call through a grant' is decided once.",
    "how_this_build_will_embody_it": "activeGrant in callGrants.ts; the shared route and the panel both use it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Append-only: a revoke must not erase that access was given.",
    "how_this_build_will_embody_it": "call_access_revocations; grants never update or delete (rules; replay)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Legal erasure must keep covering the call's words.",
    "how_this_build_will_embody_it": "Grants hold no customer words; the shared view reads the same erasure-covered tables, so an erased call shows nothing erased."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Guide, don't overtake: who may grant was the founder's decision.",
    "how_this_build_will_embody_it": "Picker 'Admin grants, logged'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The scope was a picker."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "DB rules and checks (reason, one revoke per grant); tests for admin-only, company pin, no-grant 404 with no reads, audit on every open."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T01:58:50Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
