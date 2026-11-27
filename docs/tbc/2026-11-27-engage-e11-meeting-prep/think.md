---
started_at: 2026-11-27T11:36:00Z
trigger: Engage plan E11 — meeting prep, a "next call is tomorrow" agent trigger (F13.6); founder picker "Deal-flow batch".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - E11: meeting prep

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0390; agents.ts / agentSchema.ts; daily.ts nextCallFires; the editor; the Meeting prep template; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Engage plan row E11 (02, 07; brief decisions log), written before building.
- why-this-problem-exists: reps went into booked calls without the deal's latest brief unless they opened it themselves.
- record-consulted: rss_valid_agent (0389), next_call_date (ProspectRow.nextCallDate), daily.ts date-agent path, agent_fires (0383).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one more date trigger on the existing claim path.
2. operational-effect: the night before a booked call, the brief is rewritten and the rep told, once per date.
3. synergetic-comp: same claims and test runs as the other date triggers.
4. surface: a fifth "when" option and a template chip.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Understand first: a deal's next call is already stored (next_call_date, 0303/0325) and the nightly job already fires date triggers with claims; meeting prep is one more date trigger, not a new mechanism.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Holistic: the trigger reuses the nightly job's claim-before-act path (agent_fires, 0383) and dealRisk; the agents route's schema moves to one shared file.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Four layers: a template only fills the editor (no save), the manager can change any field; the agent list says what the quiet trigger means.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Proactive audit: found the route's zod schema couldn't be shared with a test; moved to agentSchema so templates are held to the route's own check.",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "External config: runs only from the nightly cron (CRON_SECRET set; first run 2026-11-28 05:15 UTC).",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Single source: 'tomorrow' is dayIn's company day plus one — the same day the job dates everything by; no second clock.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Append-only: on_demand_agents can only be retired (trigger guard), never edited or deleted; fires are claimed rows.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Erasure: the trigger stores nothing; on_demand_agents holds a manager's instruction, not customer words.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Guide, don't overtake: a template is a starting point the manager edits and saves; nothing runs unasked.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Checklist: the founder picked this batch; the trigger detail is recorded in the plan (03-DATA-MODEL, decisions log) before building.",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Reachable: the trigger is in the editor, a template, and the nightly job.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T11:36:00Z",
    "why_it_governs": "Surfacing gate: a gone-quiet run tells the rep a fact dealRisk already shows on the deal, not a new diagnosis.",
    "how_this_build_will_embody_it": "The template's to-do is dealRisk's own advice (RISK_FIX)."
  }
]
```
