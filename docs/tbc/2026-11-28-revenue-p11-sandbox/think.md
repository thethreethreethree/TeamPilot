---
started_at: 2026-11-28T11:33:00Z
trigger: Revenue plan phase 11 — sandbox company (F2.9); founder picker 2026-11-28 "Sandbox company".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Sandbox company

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0397 (flag, guard, rss_sandbox_seed); scripts/sandbox/seed.mjs; the dashboard's "Sample data" banner.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: revenue plan phase 11 rows (02, 07, decisions log), written before building.
- why-this-problem-exists: trials and demos had no company to show without putting sample data into a real one.
- record-consulted: /api/seed (env-gated), profiles (id → auth.users, sales_coach_role admin|staff), companies checks and triggers, accounts/contacts/deals event tables and value shapes, coaching_sessions and transcript checks, 0304 (a call joins its rep's deal).
- conflicts-with-framework: NONE.
- ambiguities: the admin email is the founder's (on record as their step).

## FOUR-LAYER
1. build-structure: one flag, one server-only seed in one transaction, one operator script.
2. operational-effect: a sandbox with accounts, deals (a split), calls and contacts, ready to demo.
3. synergetic-comp: every feature reads it like any company; the seed refuses real ones.
4. surface: "Sample data" on every page.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Understand first: §3.4 refuses sample data in a real company, and the existing /api/seed opens seeding for a whole environment by an env flag. A per-company flag the server alone sets, and a seed that refuses any company without it, keeps sample data out of every real company by construction.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Holistic: everyone's totals don't change (shares add up to 100); only per-person rows move. The forecast submission's snapshot is still the rep's own deals (recorded as a residual).",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Four layers (surface): a read-only view disables every control at once and drops tabs that would refuse, instead of showing working buttons that fail.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Proactive: the item read is paged to the end, not a .limit (a page of scores can carry more than 1,000 item rows).",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "External step: making the sandbox needs a real admin email from the founder; the script is ready, dry run by default, and the step is on record in OPEN.md, not done for them.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Single source: shareTotals uses shareOf, the same rule as the forecast; an own deal is the caller's (read by rep_id).",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Append-only: a new split is a new row; the latest is the deal's (deal_splits_current); deletes and edits do nothing.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Erasure: the sample is fictional (no customer's words); the sandbox is a company like any other for erasure.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Guide, don't overtake: the founder runs --apply with their email; the build doesn't create accounts on their behalf.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-392",
    "read_at": "2026-11-28T11:33:00Z",
    "why_it_governs": "No instant results: a system that behaves the same for every customer claims understanding it can't have, so sample data must never enter a real company's record — the sandbox is a separate, flagged company and the seed refuses any other.",
    "how_this_build_will_embody_it": "rss_sandbox_seed refuses a company without is_sandbox; only the server sets the flag; every page in a sandbox says Sample data."
  }
]
```
