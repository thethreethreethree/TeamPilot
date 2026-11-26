---
started_at: 2026-11-26T22:50:00Z
trigger: Plan check after the review fixes: docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN/docs/02-FEATURE-MENU.md row E4 names ask_deal, ask_account, generate_brief, find_calls; only ask_deal shipped (9eb3a304).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E4 completed: the three missing MCP tools

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: src/lib/api/mcpTools.ts, src/app/api/mcp/route.ts, their test; the plan README.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build what the plan says, without shortcuts.
- why-this-problem-exists: E4 shipped list/get tools and ask_deal; the menu's other three tools were left out.
- record-consulted: 02-FEATURE-MENU.md, mcpTools.ts, dealCalls.ts, dealBriefRun.ts, the brief route, publicApiRead.ts (the calls list).
- conflicts-with-framework: NONE.
- ambiguities: NONE. A brief written over MCP is recorded as the key creator's (a company key acts for the company, plan E8 as revised).

## FOUR-LAYER
1. build-structure: three tools in the one tools file; mergeAccountCalls is pure and tested.
2. operational-effect: find_calls pinned to the company, hides left out; generate_brief uses only unhidden calls and the one brief writer; ask_account answers from the account's newest five calls.
3. synergetic-comp: a brief written over MCP is the same brief the deal page shows (same basis rule).
4. surface: the server's instructions say generate_brief writes.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Outside settings: none new; Postmark, Twilio, CRON_SECRET, SUPABASE_JWT_SECRET stay recorded in OPEN.md.",
    "how_this_build_will_embody_it": "No new outside dependency."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Understand first: the E4 feature menu names four MCP tools; three never shipped (ask_account, generate_brief, find_calls).",
    "how_this_build_will_embody_it": "Each built from the same readers ask_deal and the brief route use."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Holistic: the tools read deals, accounts, calls and briefs, and generate_brief writes a brief.",
    "how_this_build_will_embody_it": "The one brief writer (writeDealBrief) and the same hide helper; no new table."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Audit the neighbours: the server's instructions said read-only; generate_brief writes.",
    "how_this_build_will_embody_it": "The instructions now say so."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "One authority for hides (hiddenInCompanyFrom with OUTSIDE_READER) and for briefs (writeDealBrief).",
    "how_this_build_will_embody_it": "No copy of either rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Briefs are append-only, once per basis.",
    "how_this_build_will_embody_it": "writeDealBrief returns the stored one for the same calls."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Answers cite the lines they rest on, from the transcripts only.",
    "how_this_build_will_embody_it": "resolveCallRefs, CONVERSATION_IS_DATA."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Erasure already reaches deal briefs (0374).",
    "how_this_build_will_embody_it": "No new copy of customer words is stored."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Nothing half-understood: no transcript → a plain 'nothing to answer from', no brief written.",
    "how_this_build_will_embody_it": "ToolError text."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T22:55:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
