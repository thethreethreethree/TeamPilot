---
started_at: 2026-11-26T21:27:00Z
trigger: Revenue build plan Phase 6 (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md): the forecast, right after Phase 5 shipped (06b452cd).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue Phase 6: the forecast board

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: forecast_submissions and forecast_targets (0376); the forecast route; a board on Pipeline → Forecast, above the existing expected-value view.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong M22 covers forecast boards (F22.1), submission, metric and target columns (F22.2), submitting with a note (F22.3), weekly snapshots (F22.5) and accuracy (F22.7: green 85–115%).
- why-this-problem-exists: the Pipeline had a computed expected value (dealRisk.forecast) but no one could commit a number, there were no targets, and no record of what was forecast to measure accuracy against.
- record-consulted: dealRisk.ts (forecast, MIN_CLOSED_FOR_FORECAST), ForecastView, prospects.ts (closedAt from 0375), the teardown's M22, the plan's R12.
- conflicts-with-framework: NONE.
- ambiguities: R12 boards and periods. The stand-in: one board per company, by quarter, with Commit and Best case. Brand colours replace Gong's green / pink / red (BRAND.md: no red or green).

## FOUR-LAYER
1. build-structure: two append-only tables; the computed columns are a pure function over the pipeline; each submission stores its deals.
2. operational-effect: a rep submits Commit / Best case with a note; a manager sets targets; the team row sums the latest numbers; last quarter's accuracy shows per person.
3. synergetic-comp: the same "Whose pipeline" drives the board; the existing expected-value view stays below it.
4. surface: a compact table; accuracy chips carry a word as well as a colour.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "External-config completeness: Gong's weekly snapshot is a cron, which needs CRON_SECRET (unset in Vercel).",
    "how_this_build_will_embody_it": "Every submission is kept as its own snapshot, so accuracy needs no cron; reminders are a residual naming the precondition."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Understanding first: Gong's forecast (M22) is boards with submission, metric and target columns, a submit panel, weekly snapshots and accuracy; read from the teardown, and the existing ForecastView (expected value from win rate) read before adding to it.",
    "how_this_build_will_embody_it": "The board sits above the existing ForecastView; computed columns come from the same pipeline data."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "One authority each: the computed columns are forecast.ts over the pipeline the page loaded; a submission's deals are read on the server from the caller's pipeline, never sent by the page.",
    "how_this_build_will_embody_it": "metrics() for every column; the route calls listProspects for the snapshot."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Events are immutable: submissions and targets are appended; the latest is current and the earlier ones are the history accuracy reads.",
    "how_this_build_will_embody_it": "No update or delete on either table."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: accuracy needs something closed; unpriced deals are counted apart; the team row says how many submitted.",
    "how_this_build_will_embody_it": "accuracyBand returns null on zero; openUnpriced shown; rollUp returns submitted/of."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Schema-complete isn't built: each table needs a writer and a surface.",
    "how_this_build_will_embody_it": "forecast_submissions: Submit; forecast_targets: Set (managers); both read by the board."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:33:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
