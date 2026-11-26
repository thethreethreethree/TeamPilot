---
started_at: 2026-11-26T20:53:00Z
trigger: Revenue build plan Phase 3 (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md), part a: Gong's deal warnings, right after Phase 2 shipped (b3e87459).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 3a: Gong's deal warnings in dealRisk

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: rss_deal_signals (0372) and the optional stall_days on the stage list; dealRisk gains ghosted, few contacts, no power, no pricing and stalled; listProspects feeds them; the stage editor takes a limit.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong's eight deal warnings (F20.5). We had no activity, overdue and missed calls (dealRisk); we lacked ghosted, not enough contacts, no power, pricing not mentioned and stalled in stage. Red-flag email is out (R7, no email).
- why-this-problem-exists: dealRisk could only see the list's fields (dates, amount, to-dos, sentiment). It couldn't see who spoke on a call, whether price came up, when the stage was set, or the contacts' titles.
- record-consulted: dealRisk.ts and its tests, prospects.ts, 0277 (interaction stats), 0070 (transcript speakers), 0370/0371, the teardown's F20.5 thresholds, the plan's 04-REVENUE-RULES.md (one-authority note).
- conflicts-with-framework: NONE.
- ambiguities: R4 thresholds. Gong's published defaults where they exist; the rest are constants named in dealRisk.ts and the plan.

## FOUR-LAYER
1. build-structure: one function returns the facts, as the caller; one evaluator (dealRisk) decides; reasons need their fact.
2. operational-effect: the warnings appear on the Board, the List's risk line and the Forecast's at-risk list for every open deal.
3. synergetic-comp: a manager setting a stage limit sees stalled deals at once; contacts added in Phase 1 drive few contacts and no power.
4. surface: the existing risk chip and words; the new reasons are plain sentences.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "External-config completeness: a daily warning history needs a cron, which needs CRON_SECRET, unset in Vercel; that must be flagged, not silently depended on.",
    "how_this_build_will_embody_it": "This build computes warnings live and depends on no cron; the history is recorded as a residual naming the precondition."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Understanding first: Gong's warnings (F20.5) read facts the pipeline list didn't carry (two-way engagement, pricing, stage dates, contact ranks); read from the teardown and the live schema before code.",
    "how_this_build_will_embody_it": "rss_deal_signals returns exactly those facts; dealRisk decides."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "One authority for a deal's risk: dealRisk.ts already decided it in the live Pipeline; a second evaluator would drift.",
    "how_this_build_will_embody_it": "The Gong kinds are added to dealRisk; the board, list and forecast all consume its verdict."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Events are immutable: the stage-entered date is derived from the stage events (the first event of the latest run of a label), never stored.",
    "how_this_build_will_embody_it": "No new table; the function reads the event log."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: a warning whose fact wasn't read must not fire, and a deal whose facts failed to load must not look healthy.",
    "how_this_build_will_embody_it": "Reasons need their fact (undefined = silent); a failed signal read fails the list (500)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Schema-complete isn't built: the function needs a caller and a surface.",
    "how_this_build_will_embody_it": "listProspects calls it; the Board, List risk line and Forecast show the reasons."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T20:57:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
