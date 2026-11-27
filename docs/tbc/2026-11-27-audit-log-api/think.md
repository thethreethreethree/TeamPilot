---
started_at: 2026-11-26T23:56:00Z
trigger: Gong P1/P2 gap audit (2026-11-27): F31.5 "Audit log API" partial.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The audit log through the public API

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: publicApiRead.ts (resource "audit"), /api/v1/audit route, the keys panel sentence, tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build the Gong features still missing that need no outside service.
- why-this-problem-exists: E3 shipped deals/accounts/contacts/calls; the audit log wasn't among them.
- record-consulted: 0284 audit_log, /api/coach/remote/audit (admin-only), publicApiRead.ts, api-keys route (admins make keys), roles.ts isAdminRole.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one resource in the one handler.
2. operational-effect: an outside tool reads the company's audit log, newest first.
3. synergetic-comp: the same rows as Protection → Audit log in the app.
4. surface: the keys panel names the endpoint.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Understand first: the gap audit lists F31.5 'audit log API' as partial — the log exists (0284) and admins read it in the app, but the public API doesn't expose it.",
    "how_this_build_will_embody_it": "GET /api/v1/audit through the one read handler, company-pinned, paged."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Holistic: the audit log is admin-only in the app (ctx.isAdmin + 0284's rule); a key outlives its maker's role.",
    "how_this_build_will_embody_it": "The handler checks the maker is still an active admin on every request."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Layer 4: the keys panel says where the log is and who may read it.",
    "how_this_build_will_embody_it": "One sentence."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "One admin rule: isAdminRole (the same the app's resolveApiAuth uses).",
    "how_this_build_will_embody_it": "No second role list."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Read-only: the log is append-only and this only reads it.",
    "how_this_build_will_embody_it": "GET only."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "The log holds no customer words beyond what erasure already keeps (hints, counts).",
    "how_this_build_will_embody_it": "Same rows the app shows."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T00:05:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
