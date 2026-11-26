---
started_at: 2026-11-26T20:46:00Z
trigger: Revenue build plan Phase 2 (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md), right after Phase 1 shipped (165aec25).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 2: the deal board

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: a company stage list (0371), saved board views per person, a Board view in Pipeline with filters, columns and roll-ups by stage, and the deal panel picking stages from the list.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong's deal board (teardown F20.1, F20.13). Filters segment the deals, tabs group them with roll-ups, columns show fields, activity and warnings, and views are saved.
- why-this-problem-exists: the Pipeline had a list, a calendar, sources and a forecast, but no board. You couldn't filter by stage, close period, account or risk, or save a view, and stages were free text with no company order, so Phase 3's "stalled in stage" had nothing to count against.
- record-consulted: RemotePipeline.tsx (views, ProspectDetail, the free-text stage), dealRisk.ts (risk verdict, forecast), prospects.ts (listProspects), 0303/0320/0370, `gong-teardown.json` F20.1 and F20.13.
- conflicts-with-framework: NONE.
- ambiguities: R3 (stages). Stand-in: the stage stays the event's label and the list names and orders it, so every reader of stage_label keeps working.

## FOUR-LAYER
1. build-structure: the list is one row per change (latest wins); views are per person; the filters are a pure function with tests; risk comes from dealRisk.
2. operational-effect: a manager sets stages; everyone picks them on a deal; the board filters and rolls up the deals already in view.
3. synergetic-comp: the board sits beside List, Calendar, Sources and Forecast with the same "Whose pipeline"; a row opens the deal in the List and an account opens the account page.
4. surface: the app's tokens; a wide table scrolls inside its own container.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Understanding first: Gong's board (F20.1) is tabs, filters, columns and roll-ups over deals; ours already had a list, a risk verdict and a forecast view, read before building.",
    "how_this_build_will_embody_it": "The board reuses dealRisk and the list's data; nothing parallel."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "One authority per decision: risk is dealRisk's verdict; a valid stage list is the database CHECK (rss_valid_stage_list).",
    "how_this_build_will_embody_it": "filterDeals consumes dealRisk; the route maps the CHECK's answer, it doesn't re-derive it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Events are immutable: a stage list change is a new list row and a saved view change is a new row, so the history of how a company staged its deals stays whole.",
    "how_this_build_will_embody_it": "No update or delete on either table (DB rules)."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: a deal with no amount is counted apart, never as zero.",
    "how_this_build_will_embody_it": "rollUp returns unpriced separately and the board says it."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Schema-complete isn't built: each new table needs a writer and a surface.",
    "how_this_build_will_embody_it": "deal_stage_lists is written by the Stages editor and read by the board and deal panel; deal_board_views by Save view."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T20:50:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
