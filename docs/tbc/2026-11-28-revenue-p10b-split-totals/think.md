---
started_at: 2026-11-28T11:24:00Z
trigger: Revenue plan phase 10b — splits beyond the forecast; founder picker 2026-11-28 "Splits in win/loss & drivers".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Splits in your pipeline totals

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: shareTotals; the list route's totals; the stage cards' label; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: plan rows 10b (02, 07; decisions log), written before building.
- why-this-problem-exists: your pipeline totals counted a split deal whole for its rep and not at all for its co-owner.
- record-consulted: winLoss.ts (deal counts by breakdown), drivers.ts (deal counts by warning per rep), macroMode.pipelineTotals, DealBoard roll-ups (deal rows).
- conflicts-with-framework: NONE.
- ambiguities: NONE (win/loss and drivers left as counts, said in the plan).

## FOUR-LAYER
1. build-structure: one pure function beside shareOf.
2. operational-effect: your Open / Won / Lost totals are your share of own and co-owned deals.
3. synergetic-comp: matches your forecast board; a team view stays whole.
4. surface: "· your share" when a split applies.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Understand first: of the three roll-ups named, only the pipeline totals add money by person; win/loss (winLoss.ts) counts won and lost deals by how they ran and drivers (drivers.ts) count deals by warning — a split doesn't divide a deal, so those stay, said in the plan row rather than changed for the name.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Holistic: everyone's totals don't change (shares add up to 100); only per-person rows move. The forecast submission's snapshot is still the rep's own deals (recorded as a residual).",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Four layers (surface): a read-only view disables every control at once and drops tabs that would refuse, instead of showing working buttons that fail.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Proactive: the item read is paged to the end, not a .limit (a page of scores can carry more than 1,000 item rows).",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Fail loud: a failed co-owner or split read is a 500 / said on the deal; the split check refuses another company's row before reading anything.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Single source: shareTotals uses shareOf, the same rule as the forecast; an own deal is the caller's (read by rep_id).",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Append-only: a new split is a new row; the latest is the deal's (deal_splits_current); deletes and edits do nothing.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Erasure: a split holds ids and numbers only; no customer words.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Guide, don't overtake: the founder decided the access question (picker); the build follows it read only, as offered.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-28T11:24:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  }
]
```
