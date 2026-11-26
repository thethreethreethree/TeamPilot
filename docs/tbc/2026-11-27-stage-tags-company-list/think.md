---
started_at: 2026-11-26T23:39:00Z
trigger: OPEN.md 2026-11-23 stage-training "a company stage list stays open" — 0371 now provides one.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Scenario stage tags offer the company's stage list

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: stageTraining.ts stageChoices; the scenario-stages route; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: close what the record names, now that its prerequisite exists.
- why-this-problem-exists: the tag box predated the company stage list (0371).
- record-consulted: OPEN.md, scenarios/stages route, stageTraining.ts, deal-stages route (0371 list shape {name, kind}), TrainingManager (datalist stage-names).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one pure merge function.
2. operational-effect: the company's stages are offered first.
3. synergetic-comp: tags now line up with the deal board's stages.
4. surface: the same datalist.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "External: TOTP must be on in Supabase to verify end to end (OPEN.md BLOCKING SETUP).",
    "how_this_build_will_embody_it": "Stated in closure; unit-tested here."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Understand first: OPEN.md 2026-11-23 stage-training — a scenario's stage tag matched only names typed on deals; 'a company stage list stays open'. 0371 (revenue Phase 2) now gives each company one.",
    "how_this_build_will_embody_it": "The tag box offers the company list first, then names in use."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Holistic: the stage list is read through the manager's client (RLS pins the company); optional, so a company without one is unchanged.",
    "how_this_build_will_embody_it": "A failed or missing list falls back to the names in use."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Proactive: an independent review of the service-role job before its first run.",
    "how_this_build_will_embody_it": "All six findings fixed before 05:15 UTC."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "One rule for 'the same stage': stageKey; stageChoices reuses it.",
    "how_this_build_will_embody_it": "No second normaliser."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "No data change: suggestions only; a tag is still an appended event.",
    "how_this_build_will_embody_it": "PUT unchanged."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Legal erasure: the handoff carries a session token, never customer words, so nothing new needs to be reachable by erasure.",
    "how_this_build_will_embody_it": "No table, column or stored text added."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T23:43:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
