---
started_at: 2026-11-26T21:15:00Z
trigger: Revenue build plan Phase 4 (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md): win/loss, deal drivers and account activity, right after Phase 3c shipped (3fa22495).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 4: win/loss, deal drivers, account activity

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: rss_deal_signals gains closed_at and rss_account_activity is added (0375); win/loss by contacts, power and time to close; a Drivers view; the accounts' activity level.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong F20.10 win/loss (by contact count, power, duration, size, calls, competitors and trackers), F20.11 deal drivers (per rep, the share of open deals with each warning; top three marked; team-wide when more than three reps), F21.4 account activity (High / Medium / Low / Inactive from two-way engagement).
- why-this-problem-exists: win/loss had calls, size and trackers (winLoss.ts) but not contacts, power or time to close; there were no drivers; accounts (Phase 1) had no activity level.
- record-consulted: winLoss.ts and its tests, the Sources view, dealRisk.ts, 0372's rss_deal_signals, the plan's R5/R6, the teardown's F20.10, F20.11 and F21.4.
- conflicts-with-framework: NONE.
- ambiguities: R6. The existing MIN_CLOSED per row (5) is kept: it is the shipped rule, and Gong's 100 would hide every row at today's volumes. The plan's 00 is updated.

## FOUR-LAYER
1. build-structure: extensions to the existing authorities (winLoss, dealRisk) and one new pure function each (drivers, activity).
2. operational-effect: Sources shows three more win/loss tables; managers get Drivers; Accounts shows Activity.
3. synergetic-comp: Drivers open from the same "Whose pipeline"; a team-wide warning points to coaching; activity sorts attention across accounts.
4. surface: the same tables and chips as their neighbours.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "External-config completeness: a 30/90-day drivers view needs daily warnings, which need a cron and CRON_SECRET (unset).",
    "how_this_build_will_embody_it": "Drivers are live and say so; no cron is depended on."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Understanding first: Gong's win/loss (F20.10), deal drivers (F20.11) and account activity (F21.4), read from the teardown; our existing winLoss.ts and dealRisk.ts read before adding to them.",
    "how_this_build_will_embody_it": "Extensions of winLoss.ts and a drivers function over dealRisk; no parallel analytics."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "One authority each: dealRisk for warnings (drivers consume it), winLoss.ts for rates (one MIN_CLOSED), activity.ts for the level.",
    "how_this_build_will_embody_it": "drivers.ts calls dealRisk; the new bands use winLoss's band(); the accounts list calls activityScore."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Events are immutable: the closing date is derived from the stage events (the event that changed the status), never stored.",
    "how_this_build_will_embody_it": "rss_deal_signals computes closed_at from the event log."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: a rate needs MIN_CLOSED deals in its row; unknown titles are their own row, never 'no power'; drivers say they're today only.",
    "how_this_build_will_embody_it": "band() withholds a rate; powerOnDeal returns null; the Drivers note says 'today'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Schema-complete isn't built: each function needs a caller and a surface.",
    "how_this_build_will_embody_it": "rss_account_activity → listAccounts → the Activity column; closed_at → win/loss by time to close."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:20:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
