---
started_at: 2026-11-27T11:54:00Z
trigger: Revenue plan phase 8 — forecast due day and in-app reminder (F22.4); founder picker "Deal-flow batch".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Forecast due day and reminder

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0391; forecastReminders.ts; daily.ts; the forecast route (due_day); ForecastBoard; the bell; ?view=forecast; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: revenue plan phase 8 row F22.4 (02, 07; decisions log).
- why-this-problem-exists: the board had no due date, so a weekly forecast relied on a manager chasing people.
- record-consulted: 0376 forecast tables and RLS, 0226 schedule-settings guard, 0387 notification types, daily.ts, forecast.ts, the forecast route and board, NotificationBell.
- conflicts-with-framework: NONE.
- ambiguities: NONE — "who forecasts" is read from the record (submitted this quarter or last), not a new role.

## FOUR-LAYER
1. build-structure: one column + guard, one claim table, one pure rule.
2. operational-effect: on the due day, each forecaster not up to date this week gets one bell reminder.
3. synergetic-comp: the bell opens the board; the nightly job's company loop and claims as for agents.
4. surface: "Due every Monday" on the board; admins get a picker.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Understand first: forecasts are quarterly and append-only (0376) with no notion of a weekly due day; companies already carry admin-guarded schedule settings (0226), so the due day belongs beside them with the same guard shape.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Holistic: the trigger reuses the nightly job's claim-before-act path (agent_fires, 0383) and dealRisk; the agents route's schema moves to one shared file.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Four layers: a template only fills the editor (no save), the manager can change any field; the agent list says what the quiet trigger means.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Proactive audit: found the route's zod schema couldn't be shared with a test; moved to agentSchema so templates are held to the route's own check.",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "External config: runs only from the nightly cron (CRON_SECRET set); first due day for the default is Monday 2026-11-30.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Single source: the reminder's day is the nightly job's dayIn (company timezone); the period is forecast.ts periodOf; the weekday names are one constant in forecast.ts.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Append-only: forecast_reminders is a claim table (no update/delete rules); submissions are only read.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Erasure: the trigger stores nothing; on_demand_agents holds a manager's instruction, not customer words.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Guide, don't overtake: a reminder tells the person their forecast is due; it submits nothing for them.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Checklist: the founder picked this batch; the trigger detail is recorded in the plan (03-DATA-MODEL, decisions log) before building.",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Reachable: the board shows the due day (admins pick it), the bell links to ?view=forecast, the nightly job sends it.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T11:54:00Z",
    "why_it_governs": "Surfacing gate: a gone-quiet run tells the rep a fact dealRisk already shows on the deal, not a new diagnosis.",
    "how_this_build_will_embody_it": "The template's to-do is dealRisk's own advice (RISK_FIX)."
  }
]
```
