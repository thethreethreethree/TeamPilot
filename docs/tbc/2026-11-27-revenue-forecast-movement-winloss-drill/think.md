---
started_at: 2026-11-26T22:48:00Z
trigger: Plan check: docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/02-FEATURE-MENU.md rows for Phase 6 (the deals behind each cell; category movement) and Phase 4 (each bar opens its deals; the math as CSV) were not in the code.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Forecast deals and movement; win/loss drill-down and CSV

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: forecast.ts, the forecast route, ForecastBoard; winLoss.ts, RemotePipeline (win/loss tables); tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build what the plan says, without shortcuts.
- why-this-problem-exists: Phase 6 stored each submission's deals but never returned them; Phase 4's bands kept counts, not their deals.
- record-consulted: 02-FEATURE-MENU.md, 06-UI-SPEC.md (the submit panel shows the last submission, the deals behind it, progress to target), forecast.ts, winLoss.ts, toCsv.ts.
- conflicts-with-framework: the menu's "Submit with a note" is superseded by 0381 (notes refused: erasure couldn't reach them).
- ambiguities: NONE. Due day and reminder (F22.4) stays with decision R12 ("Phase 8 onward").

## FOUR-LAYER
1. build-structure: pure movement() and winLossCsv(); band ids; no migration.
2. operational-effect: opening a number shows its deals and how it moved; a win/loss row opens its deals; the CSV holds every row.
3. synergetic-comp: a deal in either list opens the deal panel (goTo).
4. surface: read-only for a number that isn't yours; "Download the math (CSV)".

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Outside settings: none new; Postmark, Twilio, CRON_SECRET, SUPABASE_JWT_SECRET stay recorded in OPEN.md.",
    "how_this_build_will_embody_it": "No new outside dependency."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Understand first: revenue menu rows F22.3 (the deals behind each cell), F22.6 (movement) and F20.10 (each bar opens its deals; the math as CSV) were not built.",
    "how_this_build_will_embody_it": "Each built from data already stored: submissions keep their deals; bands now keep theirs."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Holistic: the forecast route now returns stored deals; win/loss rows gain ids.",
    "how_this_build_will_embody_it": "The deals are names from the reader's own pipeline; a deal they can't see is counted, not named."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Audit the neighbours: the forecast submit panel and the win/loss tables.",
    "how_this_build_will_embody_it": "A manager can open a rep's number read-only; the submit input shows only to its owner."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "One authority: movement and the CSV are pure functions in forecast.ts and winLoss.ts; the CSV goes through the shared toCsv.",
    "how_this_build_will_embody_it": "No copy of the formula guard."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Submissions are append-only; movement compares the last two, nothing is rewritten.",
    "how_this_build_will_embody_it": "movement() reads the kept rows."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "No overtaking: the board shows what moved, it doesn't tell the rep what to forecast.",
    "how_this_build_will_embody_it": "Facts only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Erasure: no new copy of customer words (deal ids and amounts only).",
    "how_this_build_will_embody_it": "Names come from live deals, which erasure renames."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Nothing half-understood: the CSV leaves the rate empty below the minimum, as the screen does.",
    "how_this_build_will_embody_it": "win_rate empty below MIN_CLOSED."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
