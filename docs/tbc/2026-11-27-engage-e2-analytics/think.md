---
started_at: 2026-11-26T21:30:00Z
trigger: Engage plan Phase E2 (docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN/docs/07-BUILD-ORDER.md), right after E1 shipped (bd33c44f).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E2: analytics

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: engageStats (pure), GET /engage/stats, Engage → Analytics.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong F26.7 (activity), F26.8 (performance: connect rate, replies) and F26.9 (flow analytics) for our flows.
- why-this-problem-exists: E1 records every step and outcome, but nothing summarises them per flow or rep.
- record-consulted: flows.ts (connectRate, DEFAULT_OUTCOMES), the E1 tables and route, the teardown's F26.7–F26.9.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: a pure function over the activities the caller can see; no storage.
2. operational-effect: per flow and per rep, over 30 or 90 days.
3. synergetic-comp: a third tab beside Today and Flows.
4. surface: the same tables as the Pipeline's analytics.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Understanding first: Gong's Engage analytics (F26.7–F26.9) count activity and performance per flow and rep; read from the teardown.",
    "how_this_build_will_embody_it": "engageStats counts the same things from our activities."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "One authority for connect rate: flows.ts connectRate over the outcome list.",
    "how_this_build_will_embody_it": "engageStats calls connectRate; nothing re-derives it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Events are immutable: the analytics read the appended activities; nothing is stored.",
    "how_this_build_will_embody_it": "No new table."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: connect rate is '—' with no outcome; a failed read is an error, not zeros.",
    "how_this_build_will_embody_it": "connectRate returns null; the route returns 500 on any failed read."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Schema-complete isn't built: the activities need a surface that reads them.",
    "how_this_build_will_embody_it": "Engage → Analytics."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:35:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
