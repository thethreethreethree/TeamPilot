---
started_at: 2026-11-27T12:02:00Z
trigger: Independent review of the deal-flow batch (288a7583, 7cfada65, 03a46521).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Deal-flow batch review fixes

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: fieldHistory account words; the deal route's account names; nextCallFires window; ?view= follow; reminders' due date, window and failure handling; the bell's day; the board's unknown due day; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix what the review confirmed.
- why-this-problem-exists: each was a correct-looking rule checked against one case (an exact day, a first render, a "linked" word).
- record-consulted: the review report; daily.ts, forecastReminders.ts, fieldHistory.ts, RemotePipeline, vercel.json cron slots.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: same functions, corrected rules.
2. operational-effect: moves show; prep isn't missed; the bell opens the board; reminders arrive before the due day.
3. synergetic-comp: a reminder failure no longer costs the company its warnings and agents.
4. surface: the bell names the day; the board says when the due day can't be read.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Understand first: the independent review of the deal-flow batch traced each finding to its line — the account words, the exact-day prep match against a once-a-night run, the first-render-only view, the reminder timing against the 05:15 UTC slot, and the throw that skipped a company's warnings.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Holistic: the trigger reuses the nightly job's claim-before-act path (agent_fires, 0383) and dealRisk; the agents route's schema moves to one shared file.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Four layers: a template only fills the editor (no save), the manager can change any field; the agent list says what the quiet trigger means.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Proactive audit: found the route's zod schema couldn't be shared with a test; moved to agentSchema so templates are held to the route's own check.",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Fail loud, not silent: a due day that can't be read now says so, and a reminder failure is counted instead of silently skipping the company's warnings.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Single source: the reminder's day is the nightly job's dayIn (company timezone); the period is forecast.ts periodOf; the weekday names are one constant in forecast.ts.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Append-only: forecast_reminders is a claim table (no update/delete rules); submissions are only read.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Erasure: the trigger stores nothing; on_demand_agents holds a manager's instruction, not customer words.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Guide, don't overtake: a reminder tells the person their forecast is due; it submits nothing for them.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Checklist: the founder picked this batch; the trigger detail is recorded in the plan (03-DATA-MODEL, decisions log) before building.",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Reachable: the board shows the due day (admins pick it), the bell links to ?view=forecast, the nightly job sends it.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T12:02:00Z",
    "why_it_governs": "Surfacing gate: a gone-quiet run tells the rep a fact dealRisk already shows on the deal, not a new diagnosis.",
    "how_this_build_will_embody_it": "The template's to-do is dealRisk's own advice (RISK_FIX)."
  }
]
```
