---
started_at: 2026-11-26T21:08:00Z
trigger: Revenue build plan Phase 3 part c (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md): the deal brief and suggested next steps, right after 3b shipped (043e5d4d).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 3c: the deal brief and suggested next steps

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: deal_briefs (0374) and erasure; the brief route; the deal panel's Brief with "Add as to-do"; one shared deal-call reader for both AI reads.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong F20.3 (the deal panel's Briefs) and F20.4 (AI-suggested deal updates, accepted by a person).
- why-this-problem-exists: a manager opening a deal saw its fields and calls, but nothing read the calls as a whole and said where the deal stands, what the customer worries about and what to do next.
- record-consulted: the 3b reviewer route and playbook.ts, briefTemplatesRun.ts (store once per version), 0373's erasure bodies, the prospect route's todo action.
- conflicts-with-framework: NONE.
- ambiguities: NONE. On click only, like the call brief (founder picker "auto briefs → On click only").

## FOUR-LAYER
1. build-structure: one deal-call reader for both AI reads; the brief is stored once per basis; points are cited or dropped.
2. operational-effect: "Write a brief" reads the latest five calls; next steps become to-dos in one click; a changed basis offers a fresh brief.
3. synergetic-comp: to-dos land in the deal's To do and in Tasks; citations open the call at the line; the brief sits above the playbook letters.
4. surface: plain sections and small citation links, in the app's tokens.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Understanding first: Gong's deal brief (F20.3) and suggested updates (F20.4) summarise a deal's conversations and propose next steps a rep accepts; read from the teardown before code.",
    "how_this_build_will_embody_it": "dealBrief.ts encodes it; a next step is accepted as a to-do through the existing action."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Holistic: the brief, the reviewer and erasure share the deal-call read and the cited-evidence rule.",
    "how_this_build_will_embody_it": "loadDealCalls is one helper for both AI reads; erasure deletes briefs in both functions."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "One authority for which of a deal's calls an AI read sees: loadDealCalls, through the caller's client.",
    "how_this_build_will_embody_it": "The reviewer and the brief both call it; neither re-reads calls its own way."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Events are immutable: a brief is stored once per basis; a new basis is a new row.",
    "how_this_build_will_embody_it": "deal_briefs has no update or delete except erasure."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Guide, don't overtake: the brief suggests next steps; the rep decides which become to-dos.",
    "how_this_build_will_embody_it": "'Add as to-do' is the rep's click; nothing is created by the AI."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Erasure must reach every stored copy of the customer's words: a brief summarises and quotes them.",
    "how_this_build_will_embody_it": "Both erasure functions delete the erased deals' briefs; the probe shows 0 left."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: a point with no cited line is dropped; a brief with no points says the calls don't show enough.",
    "how_this_build_will_embody_it": "parseDealBrief drops uncited points and the unsupported standing line."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Schema-complete isn't built: deal_briefs needs a writer and a surface.",
    "how_this_build_will_embody_it": "Written by POST /brief, read by the deal panel's Brief."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:14:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
