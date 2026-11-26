---
started_at: 2026-11-26T21:22:00Z
trigger: Revenue build plan Phase 5 (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md): Ask Anything over a deal or an account, right after Phase 4 shipped (af193246).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 5: Ask Anything over a deal or an account

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: one AskCalls component, the same Ask Coach as Search and the library, on the deal panel (its calls) and the account page (its calls).
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong's Ask Anything (#14): ask a question of a deal's or an account's conversations and get a grounded answer.
- why-this-problem-exists: Ask Coach existed over a chosen set of calls (Search, a library folder) and over the pipeline's facts, but not on a deal or an account, where a manager reviews them.
- record-consulted: /api/coach/remote/ask and askCoach.ts, askPipeline.ts, the library's AskFolder, CitedAnswer, the sales-coach call route (it forwards phone and video calls to Remote Sales).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one component over the existing route; no new backend.
2. operational-effect: on a deal or account, a question (or a starter) is answered from its newest 10 calls with citations.
3. synergetic-comp: citations open the call at the line; the brief, the playbook and the ask sit together on the deal.
4. surface: the library's ask box, with starters.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Understanding first: Gong's Ask Anything on a deal or account (#14) answers from its conversations; our Ask Coach already answers across up to 10 calls with line citations through the asker's access — read before building.",
    "how_this_build_will_embody_it": "The deal and account pass their calls to the existing Ask Coach; no second AI path."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "One authority for asking across calls: askCoach (access, citations, chats); a second copy would drift.",
    "how_this_build_will_embody_it": "AskCalls posts to /api/coach/remote/ask like Search and the library."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Events are immutable: Ask Coach's chats are stored as before; nothing new is stored here.",
    "how_this_build_will_embody_it": "No new table."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: answers cite the lines they rest on, and the box says when only the newest 10 calls were asked.",
    "how_this_build_will_embody_it": "AskCalls states the count; CitedAnswer shows each citation."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Schema-complete isn't built: the ask must be reachable where a manager works a deal.",
    "how_this_build_will_embody_it": "On the deal panel and the account page."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:25:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
