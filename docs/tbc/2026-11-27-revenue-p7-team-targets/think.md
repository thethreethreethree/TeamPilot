---
started_at: 2026-11-27T00:46:00Z
trigger: docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/07-BUILD-ORDER.md phase 7 (founder picker 2026-11-27 "Team revenue targets only"; Gong F23.4).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Revenue phase 7: team revenue targets

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0386; the forecast route; ForecastBoard team row; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: the plan's next phase, as recorded in 02-FEATURE-MENU phase 7 and 00 R12.
- why-this-problem-exists: targets were per person only; the team row summed them.
- record-consulted: 0376 (targets + policies), the forecast route and board, the plan docs updated in 43f752a3.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one column.
2. operational-effect: a manager sets the team's target; the team row shows progress to it.
3. synergetic-comp: people's own targets unchanged; without a team target the row shows their sum, labelled.
4. surface: "% of team target" or "sum of people's targets".

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Understand first: revenue plan phase 7 (07-BUILD-ORDER, added 43f752a3 from the founder picker): team quarterly revenue targets, revenue only.",
    "how_this_build_will_embody_it": "0386 for_team; the route keeps person and team targets apart; the board's team row takes the manager's team target."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Holistic: 0376's insert policy already decides who may set a target (a manager for themselves or their tree); a team target is the manager's own row flagged for_team.",
    "how_this_build_will_embody_it": "No new policy."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Layer 4: brand tones only (no red/green), each band with its label and share.",
    "how_this_build_will_embody_it": "BAND tones + text."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "One authority for who may set targets: 0376's policy.",
    "how_this_build_will_embody_it": "The route doesn't re-check."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Append-only: a new target is a new row; the latest per (person, quarter, team) wins.",
    "how_this_build_will_embody_it": "0376's rules."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "A factual read of what was discussed, not advice.",
    "how_this_build_will_embody_it": "Neutral labels; never names, numbers or quotes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "No customer words (amounts only).",
    "how_this_build_will_embody_it": "n/a"
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Nothing half-understood: sections must cover real, consecutive lines; the first bad one ends the read; under two is nothing.",
    "how_this_build_will_embody_it": "parseSections."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-27T00:57:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
